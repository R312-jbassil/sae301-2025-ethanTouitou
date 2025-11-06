import type { APIRoute } from "astro";
import PocketBase from "pocketbase";

export const prerender = false;

const getPocketBaseUrl = () =>
	process.env.POCKETBASE_URL ??
	import.meta.env?.POCKETBASE_URL ??
	"http://127.0.0.1:8090";

const toNumberOrUndefined = (value: unknown) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
};

export const POST: APIRoute = async ({ request }) => {
	console.info("[save-lunette] Incoming request", {
		method: request.method,
		origin: request.headers.get("origin"),
		"content-type": request.headers.get("content-type"),
	});

	const textClone = request.clone();
	const formClone = request.clone();
	let body: Record<string, unknown> | null = null;
	let rawPayload = "";
	const contentType = request.headers.get("content-type") ?? "";

	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch (jsonError) {
		try {
			rawPayload = await textClone.text();
		} catch (textError) {
			console.error("[save-lunette] Failed to read request body", textError);
		}

		if (!body && rawPayload && rawPayload.trim().length > 0) {
			try {
				body = JSON.parse(rawPayload) as Record<string, unknown>;
			} catch (fallbackError) {
				const preview =
					rawPayload.length > 200 ? `${rawPayload.slice(0, 200)}…` : rawPayload;
				console.error("[save-lunette] Invalid JSON payload", {
					jsonError,
					fallbackError,
					preview,
				});
			}
		}

		if (!body) {
			const isFormRequest =
				contentType.includes("application/x-www-form-urlencoded") ||
				contentType.includes("multipart/form-data");
			if (isFormRequest) {
				try {
					const formData = await formClone.formData();
					if (formData) {
						const entries = Array.from(formData.entries()).map(
							([key, value]): [string, string] => [
								key,
								typeof value === "string" ? value : value.name ?? "",
							]
						);
						if (entries.length) {
							body = Object.fromEntries(entries);
						}
					}
				} catch (formError) {
					console.error("[save-lunette] Unable to parse form data", formError);
				}
			}
		}

		if (!body) {
			return new Response(
				JSON.stringify({
					success: false,
					error: `Corps de requête vide (longueur ${rawPayload.length}).`,
				}),
				{ status: 400 }
			);
		}
	}

	if (!rawPayload && body) {
		try {
			rawPayload = JSON.stringify(body).slice(0, 200);
		} catch {
			rawPayload = "";
		}
	}

	console.info("[save-lunette] Payload reçu (aperçu)", {
		length: rawPayload.length,
		preview: rawPayload.slice(0, 120),
	});

	const rawName =
		typeof body.name === "string"
			? body.name
			: typeof body.nom === "string"
			? body.nom
			: "";
	const name = rawName.trim();

	const rawCodeSvg =
		typeof body.codeSvg === "string"
			? body.codeSvg
			: typeof body.code_svg === "string"
			? body.code_svg
			: "";

	const userId =
		typeof body.userId === "string"
			? body.userId
			: typeof body.user_id === "string"
			? body.user_id
			: "";

	if (!name) {
		return new Response(
			JSON.stringify({ success: false, error: "Le nom de la création est requis." }),
			{ status: 400 }
		);
	}

	const normalizeSvg = (value: string) => {
		if (!value) return "";
		const trimmed = value.trim();
		if (trimmed.startsWith("<svg")) return trimmed;
		try {
			const decoded = decodeURIComponent(trimmed);
			return decoded.trim();
		} catch {
			return trimmed;
		}
	};

	const svgContent = normalizeSvg(rawCodeSvg);

	if (!svgContent || !svgContent.startsWith("<svg")) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Le visuel SVG est manquant ou invalide.",
			}),
			{ status: 400 }
		);
	}

	if (!userId) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Utilisateur non identifié. Connectez-vous pour sauvegarder.",
			}),
			{ status: 401 }
		);
	}

	const bridgeValue =
		body.largeurPont ?? body.largeur_pont ?? body.bridgeWidth ?? undefined;
	const lensValue =
		body.tailleVerre ?? body.taille_verre ?? body.lensSize ?? undefined;
	const materialPrimary =
		body.materiauId ?? body.IdMateriaux ?? body.materialId ?? undefined;
	const materialSecondary =
		body.materiauSecondaireId ??
		body.IdMateriaux_1 ??
		body.secondaryMaterialId ??
		undefined;

	const pb = new PocketBase(getPocketBaseUrl());

	try {
		const baseData = {
			code_svg: svgContent,
			largeur_pont: toNumberOrUndefined(bridgeValue),
			taille_verre: toNumberOrUndefined(lensValue),
			IdMateriaux:
				typeof materialPrimary === "string" && materialPrimary.length > 0
					? materialPrimary
					: undefined,
			IdMateriaux_1:
				typeof materialSecondary === "string" && materialSecondary.length > 0
					? materialSecondary
					: undefined,
		};

		let lunette;
		try {
			lunette = await pb.collection("lunette").create({
				...baseData,
				nom: name,
			});
		} catch (error) {
			const fieldErrors =
				typeof error === "object" && error && "data" in error
					? // @ts-expect-error PocketBase error shape
					  error.data?.data ?? {}
					: {};
			if (fieldErrors?.nom) {
				lunette = await pb.collection("lunette").create(baseData);
			} else {
				throw error;
			}
		}

		await pb.collection("Compose").create({
			IdUtilisateur: userId,
			IdLunette: lunette.id,
		});

		return new Response(
			JSON.stringify({
				success: true,
				lunetteId: lunette.id,
				name: lunette.nom ?? name,
			}),
			{ status: 200 }
		);
	} catch (err) {
		console.error("[save-lunette] PocketBase error", err);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Impossible d'enregistrer la création pour le moment.",
			}),
			{ status: 500 }
		);
	}
};
