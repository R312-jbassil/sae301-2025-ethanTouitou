import PocketBase from "pocketbase";

type LunetteRecord = {
	id: string;
	code_svg?: string;
	nom?: string;
	largeur_pont?: number;
	taille_verre?: number;
	date_creation?: string;
	created?: string;
};

type ComposeRecord = {
	id: string;
	created?: string;
	expand?: {
		IdLunette?: LunetteRecord;
	};
};

const selectors = {
	status: "[data-creations-status]",
	list: "[data-creations-list]",
	count: "[data-creations-count]",
};

const formatDate = (value?: string) => {
	if (!value) return "—";
	const date = new Date(value);
	return date.toLocaleDateString("fr-FR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});
};

const buildSvgPreview = (svg?: string | null) => {
	if (!svg) return null;
	try {
		const decoded = decodeURIComponent(svg);
		if (decoded.startsWith("<svg")) return decoded;
	} catch {
		// ignore decode error - fall back to raw value
	}
	return svg.startsWith("<svg") ? svg : null;
};

const renderCreations = (container: HTMLElement, records: ComposeRecord[]) => {
	if (!records.length) {
		container.innerHTML = `
			<div class="rounded-2xl border border-dashed border-[#d4c5a0] bg-[#faf7f0] px-5 py-6 text-center text-sm text-[#6b7280]">
				<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-10 w-10 text-[#d4c5a0]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25l-1.5 1.5m0 0l1.5 1.5m-1.5-1.5h12M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
				</svg>
				<p class="mt-3 font-medium text-[#1a1a1a]">Vous n'avez pas encore sauvegardé de monture.</p>
				<p class="mt-1">Utilisez le configurateur pour enregistrer vos futurs classiques.</p>
			</div>
		`;
		return;
	}

	const cards = records
		.map((record) => {
			const lunette = record.expand?.IdLunette;
			if (!lunette) return "";
			const preview = buildSvgPreview(lunette.code_svg ?? null);
			const title = lunette.nom?.trim() || `Création ${lunette.id}`;
			const createdAt = lunette.date_creation ?? lunette.created ?? record.created;
			return `
				<article class="rounded-3xl border border-[#f0e8d6] bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
					<header class="flex items-start justify-between gap-4">
						<div>
							<h3 class="text-lg font-semibold text-[#1a1a1a]">${title}</h3>
							<p class="mt-1 text-xs uppercase tracking-wide text-[#6b7280]">Créée le ${formatDate(createdAt)}</p>
						</div>
						<span class="rounded-full bg-[#d4c5a0]/30 px-3 py-1 text-xs font-semibold text-[#1a1a1a]">Personnalisée</span>
					</header>
					<div class="mt-5 overflow-hidden rounded-2xl border border-[#e8dfc9] bg-white">
						${
							preview
								? `<div class="h-48 w-full bg-white">${preview}</div>`
								: `<div class="flex h-48 items-center justify-center text-xs text-[#9ca3af]">Aperçu indisponible</div>`
						}
					</div>
					<dl class="mt-4 grid grid-cols-2 gap-3 text-xs text-[#1f2933]">
						<div>
							<dt class="font-semibold text-[#1a1a1a]">Largeur du pont</dt>
							<dd>${lunette.largeur_pont ?? "—"} mm</dd>
						</div>
						<div>
							<dt class="font-semibold text-[#1a1a1a]">Taille des verres</dt>
							<dd>${lunette.taille_verre ?? "—"} mm</dd>
						</div>
					</dl>
				</article>
			`;
		})
		.join("");

	container.innerHTML = cards;
};

const initCreationsPage = async () => {
	const statusEl = document.querySelector<HTMLElement>(selectors.status);
	const listEl = document.querySelector<HTMLElement>(selectors.list);
	const countEl = document.querySelector<HTMLElement>(selectors.count);

	if (!statusEl || !listEl || !countEl) return;

	const pocketbaseUrl =
		import.meta.env.PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090";
	const pb = new PocketBase(pocketbaseUrl);
	pb.autoCancellation(false);

	const redirectToLogin = () => {
		window.location.replace("/connexion");
	};

	if (!pb.authStore.isValid || !pb.authStore.model?.id) {
		redirectToLogin();
		return;
	}

	statusEl.textContent = "Chargement de vos créations…";
	statusEl.classList.remove("text-red-600");

	try {
		const refreshed = await pb.collection("users").authRefresh();
		const userId = refreshed.record?.id ?? pb.authStore.model?.id;

		if (!userId) {
			redirectToLogin();
			return;
		}

		const records = await pb
			.collection("Compose")
			.getFullList<ComposeRecord>({
				filter: `IdUtilisateur.id = "${userId}"`,
				sort: "-created",
				expand: "IdLunette",
			});

		const filtered = records.filter((record) => record.expand?.IdLunette);
		countEl.textContent = String(filtered.length);
		renderCreations(listEl, filtered);
		statusEl.textContent = filtered.length
			? "Retrouvez ci-dessous vos lunettes enregistrées."
			: "Vous n'avez pas encore enregistré de monture.";
	} catch (error) {
		console.error("PocketBase creations page error", error);
		statusEl.textContent =
			"Impossible de charger vos créations. Veuillez réessayer plus tard.";
		statusEl.classList.add("text-red-600");
		listEl.innerHTML =
			'<p class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">Erreur lors de la récupération des données.</p>';
	}
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		initCreationsPage().catch((error) =>
			console.error("Failed to initialise creations page", error)
		);
	});
} else {
	initCreationsPage().catch((error) =>
		console.error("Failed to initialise creations page", error)
	);
}

