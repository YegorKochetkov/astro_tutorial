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
	disableAnimation = false,
}: AnimatedNumberProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const queueRef = useRef<{ value: number; direction: "up" | "down" }[]>([]);
	const [displayedNumber, setDisplayedNumber] = useState(value);
	const [isAnimating, setIsAnimating] = useState(false);

	// Helper to calculate width in characters
	const calculateWidth = (val: number): string => {
		const digits = Math.abs(val).toString().length + (val < 0 ? 1 : 0);
		return `${digits}ch`;
	};

	const updateContainerWidth = (val: number) => {
		if (containerRef.current) {
			containerRef.current.style.width = calculateWidth(val);
		}
	};

	const adjustWidthForTransition = (currentValue: number, nextValue: number) => {
		const currentWidth = calculateWidth(currentValue);
		const nextWidth = calculateWidth(nextValue);

		// Expand immediately if next value is wider
		if (nextWidth > currentWidth) {
			updateContainerWidth(nextValue);
		}
	};

	const processQueue = (previousValue?: number) => {
		if (isAnimating || queueRef.current.length === 0 || !containerRef.current) {
			return;
		}

		const nextItem = queueRef.current.shift()!;
		const currentDisplay = previousValue ?? displayedNumber;

		if (nextItem.value === currentDisplay) {
			processQueue(currentDisplay);
			return;
		}

		adjustWidthForTransition(currentDisplay, nextItem.value);
		setIsAnimating(true);
		setDisplayedNumber(nextItem.value);

		// Find the element currently visible
		const oldNumberElement = containerRef.current.querySelector(
			".counter-number.visible"
		) as HTMLElement;

		if (!oldNumberElement) {
			// Fallback if DOM is out of sync
			setIsAnimating(false);
			processQueue(nextItem.value);
			return;
		}

		// Determine animation classes
		const isUp = nextItem.direction === "up";
		const slideOutClass = isUp ? "slide-out-up" : "slide-out-down";
		const slideInClass = isUp ? "slide-in-from-down" : "slide-in-from-up";

		// Create new element
		const newNumberElement = document.createElement("span");
		newNumberElement.className = `counter-number ${slideInClass}`;
		newNumberElement.textContent = nextItem.value.toString();

		containerRef.current.appendChild(newNumberElement);

		// Trigger animation
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				oldNumberElement.classList.replace("visible", slideOutClass);
				newNumberElement.classList.replace(slideInClass, "visible");
			});
		});

		// Cleanup after duration
		setTimeout(() => {
			if (oldNumberElement?.parentNode) {
				oldNumberElement.parentNode.removeChild(oldNumberElement);
			}

			// If shrinking (e.g. 10 -> 9), update width *after* animation
			updateContainerWidth(nextItem.value);
			setIsAnimating(false);
			onAnimationComplete?.();
			processQueue(nextItem.value);
		}, duration);
	};

	const enqueueUpdate = (newValue: number) => {
		const direction = newValue > displayedNumber ? "up" : "down";

		if (queueRef.current.length > 0) {
			const lastItem = queueRef.current[queueRef.current.length - 1];
			// Skip if pending value is same as new value
			if (newValue !== lastItem.value) {
				// Optimally update the last queued item instead of stacking
				// This acts as a debounce/throttle for rapid updates
				const finalDirection = newValue > lastItem.value ? "up" : "down";
				queueRef.current[queueRef.current.length - 1] = {
					value: newValue,
					direction: finalDirection,
				};
			}
		} else {
			queueRef.current.push({ value: newValue, direction });
		}

		processQueue();
	};

	useEffect(() => {
		// Immediate update if animation disabled
		if (displayedNumber !== value) {
			if (disableAnimation) {
				updateContainerWidth(value);
				setDisplayedNumber(value);
				onAnimationComplete?.();
			} else {
				enqueueUpdate(value);
			}
		}
	}, [value, disableAnimation]);

	// Initial setup
	useEffect(() => {
		updateContainerWidth(value);
	}, []);

	return (
		<div
			ref={containerRef}
			className={`counter-number-container ${containerClassName}`}
		>
			<span className="counter-number visible">{displayedNumber}</span>
		</div>
	);
}
