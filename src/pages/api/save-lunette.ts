import type { APIRoute } from "astro";
import PocketBase from "pocketbase";

export const POST: APIRoute = async ({ request }) => {
	const body = await request.json();

	const pb = new PocketBase("http://127.0.0.1:8090");

	try {
		// 1) créer la lunette
		const lunette = await pb.collection("lunette").create({
			code_svg: body.code_svg,
			largeur_pont: body.largeur_pont,
			taille_verre: body.taille_verre,
			IdMateriaux: body.IdMateriaux,
			IdMateriaux_1: body.IdMateriaux_1,
		});

		// 2) lier à l'utilisateur dans Compose
		if (body.userId) {
			await pb.collection("Compose").create({
				IdUtilisateur: body.userId,
				IdLunette: lunette.id,
			});
		}

		return new Response(
			JSON.stringify({ success: true, lunetteId: lunette.id }),
			{ status: 200 }
		);
	} catch (err) {
		console.error(err);
		return new Response(JSON.stringify({ success: false, error: String(err) }), {
			status: 500,
		});
	}
};
