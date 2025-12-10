import { useRef, useEffect, useState } from "preact/hooks";

interface AnimatedNumberProps {
  value: number;
  onAnimationComplete?: () => void;
  duration?: number;
  containerClassName?: string;
  disableAnimation?: boolean;
}

export default function AnimatedNumber({ 
  value, 
  onAnimationComplete, 
  duration = 300, 
  containerClassName = "", 
  disableAnimation = false 
}: AnimatedNumberProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayedNumber, setDisplayedNumber] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationQueueRef = useRef<{ value: number; direction: "up" | "down" }[]>([]);
  
  // Update container width
  const updateContainerWidth = (val: number) => {
    if (containerRef.current) {
      const digits = Math.abs(val).toString().length + (val < 0 ? 1 : 0);
      containerRef.current.style.width = `${digits}ch`;
    }
  };
  
  // Update container width before animation if needed
  const updateContainerWidthBeforeAnimation = (currentValue: number, nextValue: number) => {
    const currentDigitLength = String(currentValue).length;
    const nextDigitLength = String(nextValue).length;
    const needMoreSpaceForNewDigit = nextDigitLength >= currentDigitLength;
    if (needMoreSpaceForNewDigit) updateContainerWidth(nextValue);
  };
  
  // Process animation queue
  const processAnimationQueue = () => {
    if (isAnimating || animationQueueRef.current.length === 0 || !containerRef.current) {
      return;
    }
    
    const nextItem = animationQueueRef.current.shift()!;
    
    if (nextItem.value === displayedNumber) {
      processAnimationQueue();
      return;
    }
    
    updateContainerWidthBeforeAnimation(displayedNumber, nextItem.value);
    setIsAnimating(true);
    setDisplayedNumber(nextItem.value);
    
    const oldNumberElement = containerRef.current.querySelector(".counter-number.visible") as HTMLElement;
    
    if (!oldNumberElement) {
      setIsAnimating(false);
      processAnimationQueue();
      return;
    }
    
    const slideOutClass = nextItem.direction === "up" ? "slide-out-up" : "slide-out-down";
    const slideInClass = nextItem.direction === "up" ? "slide-in-from-down" : "slide-in-from-up";
    
    const newNumberElement = document.createElement("span");
    newNumberElement.className = `counter-number ${slideInClass}`;
    newNumberElement.textContent = nextItem.value.toString();
    
    containerRef.current.appendChild(newNumberElement);
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        oldNumberElement.classList.remove("visible");
        oldNumberElement.classList.add(slideOutClass);
        newNumberElement.classList.remove(slideInClass);
        newNumberElement.classList.add("visible");
      });
    });
    
    setTimeout(() => {
      if (oldNumberElement && oldNumberElement.parentNode) {
        oldNumberElement.parentNode.removeChild(oldNumberElement);
      }
      
      updateContainerWidth(value);
      setIsAnimating(false);
      onAnimationComplete?.();
      processAnimationQueue();
    }, duration);
  };
  
  // Queue digit change
  const queueDigitChange = (newValue: number) => {
    const direction = newValue > displayedNumber ? "up" : "down";
    
    if (animationQueueRef.current.length > 0) {
      const lastQueued = animationQueueRef.current[animationQueueRef.current.length - 1];
      if (newValue !== lastQueued.value) {
        const finalDirection = newValue > lastQueued.value ? "up" : "down";
        animationQueueRef.current[animationQueueRef.current.length - 1] = {
          value: newValue,
          direction: finalDirection
        };
      }
    } else {
      animationQueueRef.current.push({ value: newValue, direction });
    }
    
    processAnimationQueue();
  };
  
  // Handle value changes
  useEffect(() => {
    updateContainerWidthBeforeAnimation(displayedNumber, value);
    
    if (displayedNumber !== value) {
      if (disableAnimation) {
        updateContainerWidth(value);
        setDisplayedNumber(value);
        onAnimationComplete?.();
      } else {
        queueDigitChange(value);
      }
    }
  }, [value, disableAnimation]);
  
  // Initialize container width
  useEffect(() => {
    updateContainerWidth(value);
  }, []);
  
  return (
    <div 
      ref={containerRef}
      className={`counter-number-container ${containerClassName}`}
      style={{ "--containerWidth": String(value).length + "ch" }}
    >
      <span className="counter-number visible">{displayedNumber}</span>
    </div>
  );
}
