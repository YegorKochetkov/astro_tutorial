import { useRef, useEffect, useState, useCallback } from "preact/hooks";

const ANIMATION_CONFIG = {
  DEFAULT_DURATION: 300,
  STYLES: {
    COUNTER_NUMBER_CONTAINER: "counter-number-container",
    COUNTER_NUMBER: "counter-number",
    VISIBLE: "counter-number visible",
    SLIDE_OUT_UP: "slide-out-up",
    SLIDE_OUT_DOWN: "slide-out-down",
    SLIDE_IN_FROM_DOWN: "slide-in-from-down",
    SLIDE_IN_FROM_UP: "slide-in-from-up",
  },
  DIRECTION: {
    UP: "up",
    DOWN: "down",
  },
} as const;

// Type for animation queue items
interface AnimationQueueItem {
  value: number;
  direction: "up" | "down";
}

// Type for animated number props
interface AnimatedDigitProps {
  value: number;
  direction: "up" | "down" | null;
  isVisible: boolean;
  className: string;
}

interface AnimatedNumberComponentProps {
  value: number;
  onAnimationComplete?: () => void;
  // Animation duration in milliseconds (default: 300) 
  duration?: number;
  // Custom CSS class name for the container
  containerClassName?: string;
  // Disable animations (useful for reduced motion preferences)
  disableAnimation?: boolean;
}

export default function AnimatedNumber({ value, onAnimationComplete, duration = 300, containerClassName = "", disableAnimation = false }: AnimatedNumberComponentProps) {
  // At first we have one number, but then there will always be two - current and new.
  // They will have corresponding classes, direction of animation for the number and flag of what number is currently displayed
  const [animatedDigits, setAnimatedDigits] = useState<AnimatedDigitProps[]>([{ value: value, direction: null, isVisible: true, className: ANIMATION_CONFIG.STYLES.VISIBLE }]);
  const [isAnimating, setIsAnimating] = useState(false);
  // If we need to increase the width of the number container, it should be done before animating the numbers
  // If we need to decrease the width of the number container, it should be done after animating the numbers
  const { digitContainerRef, updateContainerWidth, updateContainerWidthBeforeDigitAnimation } = useContainerWidth();
  // Animation of numbers and updating the numbers themselves that need to be animated are separated into different hooks to achieve smooth animation when numbers change rapidly
  const { startAnimation, updateAnimationClasses, completeAnimation } = useAnimation(setAnimatedDigits, setIsAnimating, updateContainerWidth, onAnimationComplete, duration);
  const { animationQueue, processAnimationQueue, queueDigitChange } = useAnimationQueue(isAnimating, animatedDigits, startAnimation, updateAnimationClasses, completeAnimation);

  const prevValueRef = useRef(value);

  // Process animation queue when it changes (only if animations are enabled)
  useEffect(() => {
    if (!disableAnimation && !isAnimating && animationQueue.length > 0) {
      processAnimationQueue();
    }
  }, [animationQueue, isAnimating, disableAnimation, processAnimationQueue]);

  // Initialize container width and handle value changes
  useEffect(() => {
    updateContainerWidthBeforeDigitAnimation(prevValueRef.current, value);

    if (prevValueRef.current !== value) {
      if (disableAnimation) {
        updateContainerWidth(value);
        // Update immediately without animation
        setAnimatedDigits([
          {
            value: value,
            direction: null,
            isVisible: true,
            className: ANIMATION_CONFIG.STYLES.VISIBLE,
          },
        ]);
        onAnimationComplete?.();
      } else {
        queueDigitChange(value);
      }
      prevValueRef.current = value;
    }
  }, [value, disableAnimation]);

  const digits = animatedDigits.map((num, index) => (
    <span key={`${num.value}-${index}`} className={num.className}>
      {num.value}
    </span>
  ));

  return (
    <div className={`${ANIMATION_CONFIG.STYLES.COUNTER_NUMBER_CONTAINER} ${containerClassName}`} ref={digitContainerRef} style={{ "--containerWidth": String(value).length + "ch" }}>
      {digits}
    </div>
  );
}

function useContainerWidth() {
  const digitContainerRef = useRef<HTMLDivElement>(null);

  function updateContainerWidth(value: number) {
    if (!digitContainerRef.current) return;

    const absoluteValue = Math.abs(value);
    const numberOfDigits = absoluteValue.toString().length;
    const hasNegativeSign = value < 0;
    const digits = numberOfDigits + (hasNegativeSign ? 1 : 0);
    digitContainerRef.current.style.width = `${digits}ch`;
  }

  function updateContainerWidthBeforeDigitAnimation(value: number, nextValue: number) {
    const currentDigitLength = String(value).length;
    const nextDigitLength = String(nextValue).length;
    const needMoreSpaceForNewDigit = nextDigitLength >= currentDigitLength;
    needMoreSpaceForNewDigit && updateContainerWidth(nextValue);
  }

  return { digitContainerRef, updateContainerWidth, updateContainerWidthBeforeDigitAnimation };
}

function useAnimation(
  setAnimatedDigits: React.Dispatch<React.SetStateAction<AnimatedDigitProps[]>>,
  setIsAnimating: React.Dispatch<React.SetStateAction<boolean>>,
  updateContainerWidth: (value: number) => void,
  onAnimationComplete?: () => void,
  duration?: number
) {
  const timeoutRef = useRef<number | null>(null);

  const startAnimation = useCallback(
    (nextItem: AnimationQueueItem) => {
      setIsAnimating(true);

      const slideOutClass = nextItem.direction === ANIMATION_CONFIG.DIRECTION.UP ? ANIMATION_CONFIG.STYLES.SLIDE_OUT_UP : ANIMATION_CONFIG.STYLES.SLIDE_OUT_DOWN;
      const slideInClass = nextItem.direction === ANIMATION_CONFIG.DIRECTION.UP ? ANIMATION_CONFIG.STYLES.SLIDE_IN_FROM_DOWN : ANIMATION_CONFIG.STYLES.SLIDE_IN_FROM_UP;

      setAnimatedDigits((prev) => {
        // Mark all numbers for hiding and add slide out class
        const updated = prev.map((num) => ({
          ...num,
          isVisible: false,
          className: `${ANIMATION_CONFIG.STYLES.COUNTER_NUMBER} ${slideOutClass}`,
        }));
        // Add the new number with slide in class
        return [
          ...updated,
          {
            value: nextItem.value,
            direction: nextItem.direction,
            isVisible: false,
            className: `${ANIMATION_CONFIG.STYLES.COUNTER_NUMBER} ${slideInClass}`,
          },
        ];
      });
    },
    [setAnimatedDigits, setIsAnimating]
  );

  const updateAnimationClasses = useCallback(
    (nextItem: AnimationQueueItem) => {
      // Wait for the slide out animation to finish, then mark the new number as visible
      // Double RAF prevents a situation where the browser combines the installation of initial and final styles in one step, which will lead to lack of animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimatedDigits((prev) =>
            prev.map((num) =>
              num.value === nextItem.value && num.direction === nextItem.direction
                ? {
                    ...num,
                    isVisible: true,
                    className: ANIMATION_CONFIG.STYLES.VISIBLE,
                  }
                : num
            )
          );
        });
      });
    },
    [setAnimatedDigits]
  );

  const completeAnimation = useCallback(
    (nextItem: AnimationQueueItem) => {
      // Wait for the animation duration plus a frame to ensure the animation has time to complete
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        // Remove the hidden numbers and update the container width. Now we have only one number in animation queue
        setAnimatedDigits((prev) => prev.filter((num) => num.isVisible || num.value === nextItem.value));
        updateContainerWidth(nextItem.value);
        setIsAnimating(false);
        onAnimationComplete?.();
        timeoutRef.current = null;
      }, duration);
    },
    [setAnimatedDigits, setIsAnimating, updateContainerWidth, onAnimationComplete, duration]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    startAnimation,
    updateAnimationClasses,
    completeAnimation,
  };
}

// Animation queue can change more often than the actual animation duration
// We must ensure that the animation starts only after the previous animation has finished
function useAnimationQueue(
  isAnimating: boolean,
  animatedDigits: AnimatedDigitProps[],
  startAnimation: (nextItem: AnimationQueueItem) => void,
  updateAnimationClasses: (nextItem: AnimationQueueItem) => void,
  completeAnimation: (nextItem: AnimationQueueItem) => void
) {
  const [animationQueue, setAnimationQueue] = useState<AnimationQueueItem[]>([]);

  const processAnimationQueue = useCallback(() => {
    if (isAnimating || animationQueue.length === 0) {
      return;
    }

    const [nextItem, ...remainingItems] = animationQueue;
    setAnimationQueue(remainingItems);

    const currentVisible = animatedDigits.find((num) => num.isVisible);
    if (!currentVisible) return;
    if (nextItem.value === currentVisible.value) return;

    // Start the animation for the next item in the queue
    startAnimation(nextItem);
    updateAnimationClasses(nextItem);
    completeAnimation(nextItem);
  }, [isAnimating, animationQueue, animatedDigits, startAnimation, updateAnimationClasses, completeAnimation]);

  // Adds a new digit change to the queue if it's not already queued and updates the current visible digit's direction if necessary
  const queueDigitChange = useCallback(
    (newValue: number) => {
      const currentVisible = animatedDigits.find((n) => n.isVisible);
      if (!currentVisible) return;

      const currentValue = currentVisible.value;
      if (currentValue === newValue) return;

      const direction = newValue > currentValue ? ANIMATION_CONFIG.DIRECTION.UP : ANIMATION_CONFIG.DIRECTION.DOWN;

      setAnimationQueue((prevQueue) => {
        if (prevQueue.length === 0) {
          return [{ value: newValue, direction }];
        }

        const lastQueued = prevQueue[prevQueue.length - 1];
        if (newValue === lastQueued.value) {
          return prevQueue;
        }
        // If the new value has the opposite direction, replace the last queued item with the new value
        const finalDirection = newValue > lastQueued.value ? ANIMATION_CONFIG.DIRECTION.UP : ANIMATION_CONFIG.DIRECTION.DOWN;
        return [...prevQueue.slice(0, -1), { value: newValue, direction: finalDirection }];
      });
    },
    [animatedDigits]
  );

  return {
    animationQueue,
    processAnimationQueue,
    queueDigitChange,
  };
}
