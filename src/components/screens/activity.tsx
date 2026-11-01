import { useEffect, useState } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import { Panel } from "@/components/ui/panel";
import { Table } from "@/components/ui/table";
import { ScreenTitle } from "./screen-title";
import { query } from "@/lib/api";
import { actionLabels, type Obj } from "@/lib/dashboard";

export function ActivityScreen() {
	const { orgId, isAdmin, setError } = useDashboard();
	const [activity, setActivity] = useState<Obj[]>([]);
	useEffect(() => {
		if (orgId && isAdmin)
			query("activity", { orgId })
				.then((d) => setActivity(d.rows))
				.catch((e) => setError(e.message));
	}, [orgId, isAdmin]);
	return (
		<>
			<ScreenTitle
				text="Change History"
				desc="The latest 200 changes made in GatherWell."
			/>
			<Panel title="Recent Changes">
				{isAdmin ? (
					activity.length ? (
						<Table
							heads={["When", "Who", "What", "Event", "Details"]}
							rows={activity.map((a) => [
								new Date(a.createdAt).toLocaleString(),
								a.actor || "Removed user",
								actionLabels[a.action] || a.action,
								a.event || "",
								a.details || "",
							])}
						/>
					) : (
						<p className="muted">No changes recorded yet.</p>
					)
				) : (
					<p className="muted">
						Only owners and managers can view change history.
					</p>
				)}
			</Panel>
		</>
	);
}
