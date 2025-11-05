import PocketBase from "pocketbase";

type PocketBaseUser = {
	id: string;
	name?: string;
	email: string;
	avatar?: string;
	emailVisibility?: boolean;
	verified?: boolean;
	created?: string;
	updated?: string;
};

type LunetteRecord = {
	id: string;
	code_svg?: string;
	largeur_pont?: number;
	taille_verre?: number;
	created?: string;
	expand?: {
		IdLunette?: Array<LunetteRecord>;
	};
};

type ComposeRecord = {
	id: string;
	expand?: {
		IdLunette?: LunetteRecord;
	};
	created?: string;
};

const selectors = {
	name: "[data-user-name]",
	email: "[data-user-email]",
	status: "[data-user-status]",
	created: "[data-user-created]",
	avatar: "[data-user-avatar]",
	displayName: "[data-user-display]",
	emailDetail: "[data-user-email-detail]",
	emailVisibility: "[data-user-email-visibility]",
	verification: "[data-user-verification]",
	glassesCount: "[data-glasses-count]",
	glassesList: "[data-glasses-list]",
	logout: "[data-logout]",
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

const buildSvgPreview = (record: LunetteRecord) => {
	if (!record.code_svg) return null;
	try {
		const decoded = decodeURIComponent(record.code_svg);
		if (!decoded.startsWith("<svg")) return null;
		return decoded;
	} catch {
		return null;
	}
};

const renderGlasses = (container: HTMLElement, records: ComposeRecord[]) => {
	if (!records.length) {
		container.innerHTML = `
			<div class="rounded-2xl border border-dashed border-[#d4c5a0] bg-[#faf7f0] px-5 py-6 text-center text-sm text-[#6b7280]">
				<svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-10 w-10 text-[#d4c5a0]" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25l-1.5 1.5m0 0l1.5 1.5m-1.5-1.5h12M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
				</svg>
				<p class="mt-3 font-medium text-[#1a1a1a]">Aucune création sauvegardée pour le moment.</p>
				<p class="mt-1">
					Personnalisez vos montures et sauvegardez-les pour les retrouver ici.
				</p>
			</div>
		`;
		return;
	}

	const cards = records
		.map((record) => {
			const lunette = record.expand?.IdLunette;
			const preview = lunette ? buildSvgPreview(lunette) : null;
			return `
				<article class="rounded-2xl border border-[#f0e8d6] bg-[#fbf8f2] p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
					<div class="flex items-start justify-between gap-4">
						<div>
							<h3 class="text-base font-semibold text-[#1a1a1a]">Création ${lunette?.id ?? record.id}</h3>
							<p class="mt-1 text-xs uppercase tracking-wide text-[#6b7280]">
								Sauvegardée le ${formatDate(record.created)}
							</p>
						</div>
						<span class="rounded-full bg-[#d4c5a0]/30 px-3 py-1 text-xs font-semibold text-[#1a1a1a]">
							Lunette
						</span>
					</div>
					<div class="mt-4 overflow-hidden rounded-xl border border-[#e8dfc9] bg-white">
						${
							preview
								? `<div class="h-40 w-full bg-white">${preview}</div>`
								: `<div class="flex h-40 items-center justify-center text-xs text-[#9ca3af]">Aperçu indisponible</div>`
						}
					</div>
					<ul class="mt-4 grid grid-cols-2 gap-3 text-xs text-[#1f2933]">
						<li>
							<span class="font-semibold text-[#1a1a1a]">Pont :</span>
							${lunette?.largeur_pont ?? "—"} mm
						</li>
						<li>
							<span class="font-semibold text-[#1a1a1a]">Verre :</span>
							${lunette?.taille_verre ?? "—"} mm
						</li>
					</ul>
				</article>
			`;
		})
		.join("");

	container.innerHTML = cards;
};

const initAccountPage = async () => {
	const nameEl = document.querySelector<HTMLElement>(selectors.name);
	const emailEl = document.querySelector<HTMLElement>(selectors.email);
	const statusEl = document.querySelector<HTMLElement>(selectors.status);
	const createdEl = document.querySelector<HTMLElement>(selectors.created);
	const avatarEl = document.querySelector<HTMLImageElement>(selectors.avatar);
	const displayEl = document.querySelector<HTMLElement>(selectors.displayName);
	const emailDetailEl = document.querySelector<HTMLElement>(selectors.emailDetail);
	const emailVisibilityEl = document.querySelector<HTMLElement>(
		selectors.emailVisibility
	);
	const verificationEl = document.querySelector<HTMLElement>(selectors.verification);
	const glassesCountEl = document.querySelector<HTMLElement>(selectors.glassesCount);
	const glassesListEl = document.querySelector<HTMLElement>(selectors.glassesList);
	const logoutButton = document.querySelector<HTMLButtonElement>(selectors.logout);

	if (!nameEl || !emailEl || !statusEl || !createdEl || !glassesListEl) {
		return;
	}

	const pocketbaseUrl =
		import.meta.env.PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090";
	const pb = new PocketBase(pocketbaseUrl);
	pb.autoCancellation(false);

	const redirectToLogin = () => {
		window.location.replace("/connexion");
	};

	if (!pb.authStore.isValid || !pb.authStore.model) {
		redirectToLogin();
		return;
	}

	logoutButton?.addEventListener("click", () => {
		pb.authStore.clear();
		redirectToLogin();
	});

	try {
		const refreshed = await pb.collection("users").authRefresh<PocketBaseUser>();

		const user = refreshed.record ?? pb.authStore.model;
		if (!user) {
			redirectToLogin();
			return;
		}

		nameEl.textContent = user.name || "Utilisateur TaVue";
		displayEl && (displayEl.textContent = user.name || "Non renseigné");
		emailEl.textContent = user.email;
		emailDetailEl && (emailDetailEl.textContent = user.email);
		statusEl.textContent = user.verified ? "Statut : compte vérifié" : "Statut : vérification en attente";
		statusEl.classList.toggle("text-green-600", Boolean(user.verified));
		statusEl.classList.toggle("text-[#d97706]", !user.verified);
		createdEl.textContent = formatDate(user.created);
		emailVisibilityEl &&
			(emailVisibilityEl.textContent = user.emailVisibility
				? "Visible pour les autres utilisateurs"
				: "Visible uniquement par vous");
		verificationEl &&
			(verificationEl.textContent = user.verified
				? "Adresse confirmée"
				: "En attente de confirmation");

		if (user.avatar && avatarEl) {
			const avatarUrl = pb.files.getUrl(user as any, user.avatar, {
				thumb: "200x200",
			});
			avatarEl.src = avatarUrl;
		}

		const composeRecords = await pb
			.collection("Compose")
			.getFullList<ComposeRecord>({
				filter: `IdUtilisateur.id = "${user.id}"`,
				expand: "IdLunette",
				sort: "-created",
			});

		const validRecords = composeRecords.filter((record) => record.expand?.IdLunette);
		if (glassesCountEl) {
			glassesCountEl.textContent = String(validRecords.length);
		}
		renderGlasses(glassesListEl, validRecords);
	} catch (error) {
		console.error("PocketBase account loading error", error);
		statusEl.textContent =
			"Impossible de charger votre compte. Essayez de vous reconnecter.";
		statusEl.classList.add("text-red-600");
		glassesListEl.innerHTML =
			'<p class="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">Les lunettes n\'ont pas pu être récupérées. Veuillez réessayer plus tard.</p>';
	}
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		initAccountPage().catch((error) =>
			console.error("Failed to initialize account page", error)
		);
	});
} else {
	initAccountPage().catch((error) =>
		console.error("Failed to initialize account page", error)
	);
}
