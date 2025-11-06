import type { APIRoute } from "astro";
import { COLOR_PALETTE, findColorByName } from "../../utils/colorPalette";

export const prerender = false;

type AiRequestBody = {
	prompt?: string;
	current?: {
		branches?: string;
		frame?: string;
		lenses?: string;
	};
};

type AiResponse = {
	branches: string;
	frame: string;
	lenses: string;
	reason?: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";
const DEFAULT_REFERER = "https://tavuee.ethantouitou.fr";
const DEFAULT_TITLE = "TaVue Configurateur IA";

const getApiKey = () =>
	process.env.OPENROUTER_API_KEY ??
	import.meta.env?.OPENROUTER_API_KEY ??
	"";

const getModelId = () =>
	process.env.OPENROUTER_MODEL ??
	import.meta.env?.OPENROUTER_MODEL ??
	DEFAULT_MODEL;

const getReferer = () =>
	process.env.OPENROUTER_SITE ??
	import.meta.env?.OPENROUTER_SITE ??
	DEFAULT_REFERER;

const getTitle = () =>
	process.env.OPENROUTER_TITLE ??
	import.meta.env?.OPENROUTER_TITLE ??
	DEFAULT_TITLE;

const buildSystemPrompt = () => {
	const palette = COLOR_PALETTE.map(
		(entry) => `- ${entry.name} (${entry.value})`
	).join("\n");

	return `Tu es un assistant de style pour lunettes. Tu dois choisir des couleurs cohérentes parmi la palette disponible, sans jamais inventer de nouvelle couleur.

Palette autorisée :
${palette}

Réponds STRICTEMENT avec un JSON unique de la forme suivante :
{"branches":"Nom","frame":"Nom","lenses":"Nom","reason":"Une phrase qui justifie le choix"}

Contraintes :
- Utilise uniquement les noms listés ci-dessus.
- branches = branches, frame = monture/pont, lenses = verres.
- Si l'utilisateur ne précise rien, propose une combinaison équilibrée et élégante.
- Le champ reason est optionnel mais apprécié.`;
};

const extractJson = (content: string) => {
	const match = content.match(/\{[\s\S]*\}/);
	return match ? match[0] : content;
};

export const POST: APIRoute = async ({ request }) => {
	const apiKey = getApiKey();

	if (!apiKey) {
		return new Response(
			JSON.stringify({
				success: false,
				error:
					"Aucune clé OpenRouter configurée. Ajoutez OPENROUTER_API_KEY à votre environnement serveur.",
			}),
			{ status: 503 }
		);
	}

	let body: AiRequestBody;
	try {
		body = (await request.json()) as AiRequestBody;
	} catch (error) {
		return new Response(
			JSON.stringify({ success: false, error: "Requête invalide." }),
			{ status: 400 }
		);
	}

	const userPrompt = body.prompt?.trim();
	if (!userPrompt) {
		return new Response(
			JSON.stringify({
				success: false,
				error: "Merci de renseigner une description avant de lancer l'IA.",
			}),
			{ status: 400 }
		);
	}

	const current = body.current ?? {};
	const currentDescription = `Couleurs actuelles : branches = ${current.branches ?? "—"}, monture = ${current.frame ?? "—"}, verres = ${current.lenses ?? "—"}.`;

	try {
		const response = await fetch(OPENROUTER_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
				"HTTP-Referer": getReferer(),
				"X-Title": getTitle(),
			},
			body: JSON.stringify({
				model: getModelId(),
				temperature: 0.6,
				max_tokens: 300,
				messages: [
					{
						role: "system",
						content: buildSystemPrompt(),
					},
					{
						role: "user",
						content: `${currentDescription}\n\nDemande : ${userPrompt}`,
					},
				],
			}),
		});

		if (!response.ok) {
			const errorPayload = await response.text();
			console.error("[generate-colors] OpenRouter error", errorPayload);
			return new Response(
				JSON.stringify({
					success: false,
					error: "La génération IA a échoué. Réessayez plus tard.",
				}),
				{ status: 502 }
			);
		}

		const payload = (await response.json()) as {
			choices?: Array<{ message?: { content?: string } }>;
		};
		const content = payload.choices?.[0]?.message?.content;
		if (!content) {
			return new Response(
				JSON.stringify({
					success: false,
					error: "Réponse de l'IA vide.",
				}),
				{ status: 502 }
			);
		}

		let parsed: AiResponse | null = null;
		try {
			parsed = JSON.parse(extractJson(content)) as AiResponse;
		} catch (error) {
			console.error("[generate-colors] JSON parsing error", error, content);
			return new Response(
				JSON.stringify({
					success: false,
					error: "Réponse IA illisible.",
				}),
				{ status: 502 }
			);
		}

		const branches = findColorByName(parsed.branches);
		const frame = findColorByName(parsed.frame);
		const lenses = findColorByName(parsed.lenses);

		if (!branches || !frame || !lenses) {
			return new Response(
				JSON.stringify({
					success: false,
					error:
						"L'IA a proposé des couleurs hors palette. Reformulez la demande.",
				}),
				{ status: 422 }
			);
		}

		return new Response(
			JSON.stringify({
				success: true,
				colors: {
					branches,
					frame,
					lenses,
				},
				reason: parsed.reason ?? null,
			}),
			{ status: 200 }
		);
	} catch (error) {
		console.error("[generate-colors] Unexpected error", error);
		return new Response(
			JSON.stringify({
				success: false,
				error: "Erreur inattendue pendant la génération.",
			}),
			{ status: 500 }
		);
	}
};
