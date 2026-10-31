export function Badge({ value }: { value: string }) {
	return (
		<span className={"pill " + value.toLowerCase().replaceAll(" ", "-")}>
			{value}
		</span>
	);
}
