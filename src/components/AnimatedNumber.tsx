import { useRef, useEffect, useState } from "preact/hooks";

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

interface AnimatedNumberComponentProps {
	value: number;
	onAnimationComplete?: () => void;
	/** Animation duration in milliseconds (default: 300) */
	duration?: number;
	/** Custom CSS class name for the container */
	containerClassName?: string;
	/** Disable animations (useful for reduced motion preferences) */
	disableAnimation?: boolean;
}

export default function AnimatedNumber({
	value,
	onAnimationComplete,
	duration = 300,
	containerClassName = "",
	disableAnimation = false,
}: AnimatedNumberComponentProps) {
	const [animatedNumbers, setAnimatedNumbers] = useState<
		AnimatedNumberProps[]
	>([
		{
			value: value,
			direction: null,
			isVisible: true,
			className: "counter-number visible",
		},
	]);
	const [isAnimating, setIsAnimating] = useState(false);
	const [animationQueue, setAnimationQueue] = useState<AnimationQueueItem[]>(
		[]
	);
	const numberContainerRef = useRef<HTMLDivElement>(null);
	const prevValueRef = useRef(value);
	const timeoutRef = useRef<number | null>(null);

	// Update container width based on number of digits
	const updateContainerWidth = (value: number) => {
		if (numberContainerRef.current) {
			const digits =
				Math.abs(value).toString().length + (value < 0 ? 1 : 0);
			numberContainerRef.current.style.width = `${digits}ch`;
		}
	};

	// Process animation queue
	const processAnimationQueue = () => {
		if (
			isAnimating ||
			animationQueue.length === 0 ||
			!numberContainerRef.current
		) {
			return;
		}

		const [nextItem, ...remainingItems] = animationQueue;
		setAnimationQueue(remainingItems);

		const currentVisible = animatedNumbers.find((num) => num.isVisible);
		if (!currentVisible) return;

		// Use strict equality and handle zero properly
		if (nextItem.value === currentVisible.value) return;

		setIsAnimating(true);

		const slideOutClass =
			nextItem.direction === "up" ? "slide-out-up" : "slide-out-down";
		const slideInClass =
			nextItem.direction === "up"
				? "slide-in-from-down"
				: "slide-in-from-up";

		setAnimatedNumbers((prev) => {
			const updated = prev.map((num) => ({
				...num,
				isVisible: false,
				className: `counter-number ${slideOutClass}`,
			}));

			return [
				...updated,
				{
					value: nextItem.value,
					direction: nextItem.direction,
					isVisible: false,
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
			updateContainerWidth(nextItem.value);
			requestAnimationFrame(() => {
				setAnimatedNumbers((prev) =>
					prev.map((num) =>
						num.value === nextItem.value &&
						num.direction === nextItem.direction
							? {
									...num,
									isVisible: true,
									className: "counter-number visible",
							  }
							: num
					)
				);
			});
		});

		// Clear any existing timeout to prevent memory leaks
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}

		timeoutRef.current = window.setTimeout(() => {
			setAnimatedNumbers((prev) =>
				prev.filter(
					(num) => num.isVisible || num.value === nextItem.value
				)
			);
			setIsAnimating(false);
			onAnimationComplete?.();
			timeoutRef.current = null;
		}, duration);
	};

	// Queue number change with animation
	const queueNumberChange = (newValue: number) => {
		const currentVisible = animatedNumbers.find((n) => n.isVisible);
		if (!currentVisible) return;

		const currentValue = currentVisible.value;

		// Use strict equality check including for zero
		if (newValue === currentValue) return;

		const direction = newValue > currentValue ? "up" : "down";

		setAnimationQueue((prevQueue) => {
			// If queue is empty, just add the new value
			if (prevQueue.length === 0) {
				return [{ value: newValue, direction }];
			}

			// Get the last queued value
			const lastQueued = prevQueue[prevQueue.length - 1];

			// If the new value is the same as the last queued, do nothing
			if (newValue === lastQueued.value) {
				return prevQueue;
			}

			// Calculate direction based on last queued value, not current value
			const finalDirection = newValue > lastQueued.value ? "up" : "down";

			// Replace the last item with the new value and direction
			return [
				...prevQueue.slice(0, -1),
				{ value: newValue, direction: finalDirection },
			];
		});
	};

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	// Process animation queue when it changes (only if animations are enabled)
	useEffect(() => {
		if (!disableAnimation && !isAnimating && animationQueue.length > 0) {
			processAnimationQueue();
		}
	}, [animationQueue, isAnimating, animatedNumbers, disableAnimation]);

	// Initialize container width and handle value changes
	useEffect(() => {
		updateContainerWidth(value);

		if (prevValueRef.current !== value) {
			if (disableAnimation) {
				// Update immediately without animation
				setAnimatedNumbers([{
					value: value,
					direction: null,
					isVisible: true,
					className: "counter-number visible",
				}]);
				onAnimationComplete?.();
			} else {
				queueNumberChange(value);
			}
			prevValueRef.current = value;
		}
	}, [value, disableAnimation]);

	const numbers = animatedNumbers.map((num, index) => (
		<span key={`${num.value}-${index}`} className={num.className}>
			{num.value}
		</span>
	));

	return (
		<div 
			className={`counter-number-container ${containerClassName}`.trim()} 
			ref={numberContainerRef}
		>
			{numbers}
		</div>
	);
}
