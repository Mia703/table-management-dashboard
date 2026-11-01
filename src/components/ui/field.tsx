import { useId } from "react";

// A labelled input or select. `hint` explains the field under the label;
// `placeholder` shows an example value inside an empty input.
export function Field({
	label,
	value,
	onChange,
	type = "text",
	required = false,
	options,
	placeholder,
	hint,
	min,
}: {
	label: string;
	value: any;
	onChange: (s: string) => void;
	type?: string;
	required?: boolean;
	options?: string[];
	placeholder?: string;
	hint?: string;
	min?: number;
}) {
	const hintId = useId();
	return (
		<div className="field">
			<label>
				{label}
				{hint && (
					<span className="hint" id={hintId}>
						{hint}
					</span>
				)}
				{options ? (
					<select
						value={value ?? ""}
						aria-describedby={hint ? hintId : undefined}
						onChange={(e) => onChange(e.target.value)}
					>
						{options.map((s) => (
							<option key={s} value={s}>
								{s}
							</option>
						))}
					</select>
				) : (
					<input
						type={type}
						required={required}
						min={min}
						placeholder={placeholder}
						aria-describedby={hint ? hintId : undefined}
						value={value ?? ""}
						onChange={(e) => onChange(e.target.value)}
					/>
				)}
			</label>
		</div>
	);
}
