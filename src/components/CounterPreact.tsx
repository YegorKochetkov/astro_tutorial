import type { CSSProperties } from "preact/compat";
import { useState, useEffect, useRef } from "preact/hooks";

// Type for animation queue items
interface AnimationQueueItem {
  value: number;
  direction: "up" | "down";
}

// Type for animated number props
interface AnimatedNumberProps {
  value: number;
  direction: "up" | "down" | null;
  isVisible: boolean;
  className: string;
}

export default function CounterPreact() {
  const [count, setCount] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationQueue, setAnimationQueue] = useState<AnimationQueueItem[]>([]);

  // Here there will be two elements (current number and next number) from which two span elements will be created; after the number change animation completes, one element will remain again (the next number)
  const [animatedNumbers, setAnimatedNumbers] = useState<AnimatedNumberProps[]>([
    {
      value: count,
      direction: null,
      isVisible: true,
      className: "counter-number visible",
    },
  ]);

  const numberContainerRef = useRef<HTMLDivElement>(null);

  // Calculate padding based on count value
  const padding = count > 3 ? 3 : count < 1 ? 1 : count;

  // Update container width based on number of digits
  const updateContainerWidth = (value: number) => {
    if (numberContainerRef.current) {
      const digits = Math.abs(value).toString().length + (value < 0 ? 1 : 0);
      numberContainerRef.current.style.width = `${digits}ch`;
    }
  };

  // Process animation queue
  const processAnimationQueue = () => {
    if (isAnimating === true || animationQueue.length === 0 || numberContainerRef.current === null) {
      return;
    }

    // Get the next item and update the queue
    const [nextItem, ...remainingItems] = animationQueue;
    setAnimationQueue(remainingItems);

    // If the next value is already displayed, skip animation
    const currentValue = animatedNumbers.find((num) => num.isVisible)?.value;
    if (nextItem.value === currentValue) {
      return;
    }

    // Set animating state
    setIsAnimating(true);

    // Update container width for the new number
    updateContainerWidth(nextItem.value);

    // Choose animation classes based on direction
    const slideOutClass = nextItem.direction === "up" ? "slide-out-up" : "slide-out-down";
    const slideInClass = nextItem.direction === "up" ? "slide-in-from-down" : "slide-in-from-up";

    // Add the next number to the array for animation
    setAnimatedNumbers((prev) => {
      // Create a new array with updated visibility and classes
      const updated = prev.map((num) => {
        if (num.isVisible) {
          // This is the currently visible number that needs to slide out
          return {
            ...num,
            isVisible: false,
            className: `counter-number ${slideOutClass}`,
          };
        }
        return num;
      });

      // Add the new number with slide-in animation
      return [
        ...updated,
        {
          value: nextItem.value,
          direction: nextItem.direction,
          isVisible: false, // Will be set to true in the next frame
          className: `counter-number ${slideInClass}`,
        },
      ];
    });

    /* 
      Why nested requestAnimationFrame is needed:
        Animation phase separation:
        - In the previous code (before this fragment) we added a new element with a class for entrance animation (slideInClass)
        - The first requestAnimationFrame gives the browser time to apply initial styles
        - The second requestAnimationFrame runs only after the browser has rendered the first state, and changes classes to complete the animation
        Prevention of visual artifacts:
        - If we used only one requestAnimationFrame, the browser could combine both operations in a single render cycle
        - The nested call ensures that changes occur in different animation frames, providing a smooth visual effect
        In summary, we:
          First set the initial state (element with entrance class)
          Then in the next frame change it to the final state (visible element)
      This two-step approach with nested requestAnimationFrame provides smooth animation that is properly synchronized with the browser's render cycle and helps avoid visual artifacts when changing numbers in the counter.
    */
    requestAnimationFrame(() => {
      // After the first frame, update the new number to be visible
      requestAnimationFrame(() => {
        setAnimatedNumbers((prev) => {
          return prev.map((num) => {
            if (num.value === nextItem.value) {
              return {
                ...num,
                isVisible: true,
                className: "counter-number visible",
              };
            }
            return num;
          });
        });
      });
    });

    // Clean up after animation completes
    setTimeout(() => {
      // Remove old numbers that are no longer visible
      setAnimatedNumbers((prev) => {
        return prev.filter((num) => num.isVisible || num.value === nextItem.value);
      });
      setIsAnimating(false);
    }, 300);
  };

  // Queue number change with animation
  // This function is necessary to avoid glitches during rapid user clicks
  // It ensures that only one animation is processed at a time
  const queueNumberChange = (newValue: number) => {
    // Determine direction of change based on currently visible number
    const currentValue = animatedNumbers.find((n) => n.isVisible)?.value || count;
    const direction = newValue > currentValue ? "up" : "down";

    // Don't queue if the value is the same as current display
    if (newValue === currentValue) return;

    setAnimationQueue((prevQueue) => {
      // If queue is empty, just add the new item
      if (prevQueue.length === 0) {
        return [{ value: newValue, direction }];
      }

      // Get the last queued item
      const lastQueuedValue = prevQueue[prevQueue.length - 1].value;

      // If the new value is the same as the last queued value, don't add it
      if (newValue === lastQueuedValue) {
        return prevQueue;
      }

      // Determine direction based on the last queued value
      const finalDirection = newValue > lastQueuedValue ? "up" : "down";

      // Replace the last item in the queue with the new value
      return [...prevQueue.slice(0, -1), { value: newValue, direction: finalDirection }];
    });
  };

  // Process animation queue when it changes
  useEffect(() => {
    if (!isAnimating && animationQueue.length > 0) {
      processAnimationQueue();
    }
  }, [animationQueue, isAnimating]);

  // Initialize container width
  useEffect(() => {
    updateContainerWidth(count);
  }, []);

  const handleIncrement = () => {
    const newValue = count + 1;
    setCount(newValue);
    queueNumberChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = count - 1;
    setCount(newValue);
    queueNumberChange(newValue);
  };

  return (
    <div className="counter">
      <div className="counter-display">
        <span className="counter-emoji">❤️</span>
        <div className="counter-number-container" ref={numberContainerRef}>
          {animatedNumbers.map((num, index) => (
            <span key={`${num.value}-${index}`} className={num.className}>
              {num.value}
            </span>
          ))}
        </div>
      </div>
      <button onClick={handleIncrement} style={{ "--buttonPadding": `${padding}rem` } as CSSProperties}>
        👍
      </button>
      <button onClick={handleDecrement} style={{ "--buttonPadding": `${padding}rem` } as CSSProperties}>
        👎
      </button>
    </div>
  );
}
