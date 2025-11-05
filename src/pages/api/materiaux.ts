import type { APIRoute } from "astro";
import PocketBase from "pocketbase";

const getPocketBaseUrl = () =>
	process.env.POCKETBASE_URL ?? import.meta.env.POCKETBASE_URL ?? "http://127.0.0.1:8090";

export const GET: APIRoute = async () => {
	try {
		const pb = new PocketBase(getPocketBaseUrl());
		const records = await pb.collection("Materiaux").getFullList();

		const data = records.map((record) => {
			const image = record.materiau?.[0];
			return {
				id: record.id,
				label: record.label ?? record.id,
				imageUrl: image ? pb.files.getUrl(record, image) : null,
				data: record,
			};
		});

		return new Response(JSON.stringify({ success: true, items: data }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.warn("Materiaux API: fallback", error);
		return new Response(
			JSON.stringify({ success: false, items: [] }),
			{ status: 200, headers: { "Content-Type": "application/json" } }
		);
	}
};
