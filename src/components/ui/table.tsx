export function Table({
	heads,
	rows,
}: {
	heads: string[];
	rows: React.ReactNode[][];
}) {
	return (
		<div className="table-wrap">
			<table>
				<thead>
					<tr>
						{heads.map((h, i) => (
							<th key={i}>{h}</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((r, i) => (
						<tr key={i}>
							{r.map((c, j) => (
								<td key={j}>{c}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
