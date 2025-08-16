import type { CSSProperties } from "preact/compat";
import { useState } from "preact/hooks";
import AnimatedNumber from "./AnimatedNumber";

export default function CounterPreact() {
	const [count, setCount] = useState(-1);

	// Calculate padding based on count value
	const padding = count > 3 ? 3 : count < 1 ? 1 : count;

	const handleIncrement = () => {
		setCount(prev => prev + 1);
	};

	const handleDecrement = () => {
		setCount(prev => prev - 1);
	};

	return (
		<div className="counter">
			<div className="counter-display">
				<span className="counter-emoji">❤️</span>
				<AnimatedNumber value={count} />
			</div>
			<button onClick={handleIncrement} style={{ "--buttonPadding": `${padding}rem` } as CSSProperties} aria-label="Increment counter">
				👍
			</button>
			<button onClick={handleDecrement} style={{ "--buttonPadding": `${padding}rem` } as CSSProperties} aria-label="Decrement counter">
				👎
			</button>
		</div>
	);
}
