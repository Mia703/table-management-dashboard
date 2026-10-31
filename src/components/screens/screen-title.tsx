import { useDashboard } from "@/hooks/useDashboard";

export function ScreenTitle({ text, desc }: { text: string; desc: string }) {
	const { data } = useDashboard();
	return (
		<header>
			<p className="muted">
				{data.event?.name || "GatherWell"} / {text}
			</p>
			<h1>{text}</h1>
			<p className="muted">{desc}</p>
		</header>
	);
}
