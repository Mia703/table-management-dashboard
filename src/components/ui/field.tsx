export function Field({
	label,
	value,
	onChange,
	type = "text",
	required = false,
	options,
}: {
	label: string;
	value: any;
	onChange: (s: string) => void;
	type?: string;
	required?: boolean;
	options?: string[];
}) {
	return (
		<div className="field">
			<label>
				{label}
				{options ? (
					<select
						value={value ?? ""}
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
						value={value ?? ""}
						onChange={(e) => onChange(e.target.value)}
					/>
				)}
			</label>
		</div>
	);
}
