import PocketBase from "pocketbase";

type PaletteTarget = "branches" | "frame" | "lenses";

type PaletteColor = {
	value: string;
	label: string;
};

type TextureState = {
	id: string | null;
	label: string | null;
};

type ConfiguratorState = {
	branches: PaletteColor;
	frame: PaletteColor;
	lenses: PaletteColor;
	frameTexture: TextureState;
	bridge: number;
	lensSize: number;
	shape: string;
	materialLabel: string;
};

const initConfigurator = () => {
	const root = document.querySelector<HTMLElement>("[data-configurator]");
	if (!root) return;

	const svgWrapper = root.querySelector<HTMLElement>("[data-svg-wrapper]");
	const svg = svgWrapper?.querySelector("svg");
	if (!svg) {
		console.warn("[configurateur] SVG introuvable.");
		return;
	}

	const groupBranches = svg.querySelector<SVGGElement>("#branches");
	const groupFrame = svg.querySelector<SVGGElement>("#monture");
	const groupLenses = svg.querySelector<SVGGElement>("#verres");
	if (!groupBranches || !groupFrame || !groupLenses) {
		console.warn("[configurateur] Groupes branches/monture/verres manquants.");
		return;
	}

	const lensBaseTransform = groupLenses.getAttribute("transform") ?? "";

	const materialSelect =
		root.querySelector<HTMLSelectElement>("[data-materiau]");
	const formeSelect = root.querySelector<HTMLSelectElement>("select[name='forme']");
	const branchesPalette =
		root.querySelector<HTMLDivElement>("[data-color-branches]");
	const framePalette = root.querySelector<HTMLDivElement>("[data-color-frame]");
	const lensesPalette = root.querySelector<HTMLDivElement>("[data-color-lenses]");
	const materialsList =
		root.querySelector<HTMLDivElement>("[data-materials-list]");
	const pontInput =
		root.querySelector<HTMLInputElement>("input[name='largeurPont']");
	const lensInput =
		root.querySelector<HTMLInputElement>("input[name='tailleVerre']");
	const pontDisplay = root.querySelector<HTMLElement>("[data-pont-value]");
	const lensDisplay = root.querySelector<HTMLElement>("[data-verre-value]");
	const summary = root.querySelector<HTMLElement>("[data-summary]");
	const feedback = root.querySelector<HTMLElement>("[data-feedback]");
	const form = root.querySelector<HTMLFormElement>("[data-config-form]");
	const saveButton = form?.querySelector<HTMLButtonElement>("[data-save]");
	const nameInput =
		form?.querySelector<HTMLInputElement>("[data-creation-name]");
	const aiSection = document.querySelector<HTMLElement>("[data-ai-section]");
	const aiPrompt = aiSection?.querySelector<HTMLTextAreaElement>("[data-ai-prompt]");
	const aiButton = aiSection?.querySelector<HTMLButtonElement>("[data-ai-generate]");
	const aiFeedback = aiSection?.querySelector<HTMLElement>("[data-ai-feedback]");
	const aiDefaultLabel = aiButton?.textContent ?? "⚙️ Générer avec l'IA";

	if (
		!materialSelect ||
		!formeSelect ||
		!branchesPalette ||
		!framePalette ||
		!lensesPalette ||
		!materialsList ||
		!pontInput ||
		!lensInput ||
		!pontDisplay ||
		!lensDisplay ||
		!summary ||
		!form ||
		!feedback ||
		!saveButton ||
		!nameInput
	) {
		console.warn("[configurateur] éléments de formulaire manquants.");
		return;
	}

	const pocketbaseUrl =
		root.dataset.pocketbaseUrl && root.dataset.pocketbaseUrl.length > 0
			? root.dataset.pocketbaseUrl
			: "http://127.0.0.1:8090";

	const pb = new PocketBase(pocketbaseUrl);
	pb.autoCancellation(false);

	let cachedUserId =
		root.dataset.userId && root.dataset.userId !== "ID_DU_USER_A_REMPLACER"
			? root.dataset.userId
			: null;

	const resolveUserId = async (): Promise<string | null> => {
		if (cachedUserId) return cachedUserId;
		if (pb.authStore.isValid && pb.authStore.model?.id) {
			cachedUserId = pb.authStore.model.id;
			root.dataset.userId = cachedUserId;
			return cachedUserId;
		}

		try {
			const authData = await pb.collection("users").authRefresh();
			const refreshedId = authData.record?.id ?? pb.authStore.model?.id ?? null;
			if (refreshedId) {
				cachedUserId = refreshedId;
				root.dataset.userId = refreshedId;
				return refreshedId;
			}
		} catch (error) {
			console.warn("[configurateur] Impossible de rafraîchir la session PocketBase", error);
			pb.authStore.clear();
		}
		return cachedUserId;
	};

	void resolveUserId();

	const hexToRgba = (hex: string, alpha = 1) => {
		const normalized = hex.replace("#", "");
		const int = parseInt(normalized, 16);
		const r = (int >> 16) & 255;
		const g = (int >> 8) & 255;
		const b = int & 255;
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	};

	const paletteButtonColor = (button: HTMLButtonElement): PaletteColor => ({
		value: button.dataset.colorValue || "#1f1f1f",
		label: button.dataset.colorName || "Couleur",
	});

	const firstBranchColor = paletteButtonColor(
		branchesPalette.querySelector<HTMLButtonElement>("button") ??
		document.createElement("button")
	);
	const firstFrameColor = paletteButtonColor(
		framePalette.querySelector<HTMLButtonElement>("button") ??
		document.createElement("button")
	);
	const defaultLensButton =
		lensesPalette.querySelectorAll<HTMLButtonElement>("button")[4] ??
		lensesPalette.querySelector<HTMLButtonElement>("button");
	const firstLensColor = paletteButtonColor(
		defaultLensButton ?? document.createElement("button")
	);

	const svgNs = "http://www.w3.org/2000/svg";
	const defs =
		svg.querySelector("defs") ??
		svg.insertBefore(document.createElementNS(svgNs, "defs"), svg.firstChild);

	const state: ConfiguratorState = {
		branches: firstBranchColor,
		frame: firstFrameColor,
		lenses: firstLensColor,
		frameTexture: { id: null, label: null },
		bridge: Number(pontInput.value) || 20,
		lensSize: Number(lensInput.value) || 50,
		shape: formeSelect.value || "Rectangulaire",
		materialLabel:
			materialSelect.selectedOptions?.[0]?.textContent?.trim() || "Matériau",
	};

	const materialIdByCode: Record<string, string> = {};

	const slugify = (value: string) =>
		value
			.toString()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");

	const applyBranchesColor = () => {
		svg.style.setProperty("--color-branches", state.branches.value);
	};

	const applyFrameColor = () => {
		const fillValue = state.frameTexture.id
			? `url(#${state.frameTexture.id})`
			: state.frame.value;
		svg.style.setProperty("--color-frame", state.frame.value);
		const strokeWidth = Math.max(0.5, state.bridge / 4);
		groupFrame.querySelectorAll<SVGElement>("path").forEach((path) => {
			path.setAttribute("fill", fillValue);
			path.setAttribute("stroke", state.frame.value);
			path.setAttribute("stroke-width", strokeWidth.toString());
		});
	};

	const applyLensColor = () => {
		const rgba = hexToRgba(state.lenses.value, 0.45);
		svg.style.setProperty("--color-lenses", rgba);
	};

	const applyLensScale = () => {
		const bbox = groupLenses.getBBox();
		const baseScale = state.lensSize / 50;
		let scaleX = baseScale;
		let scaleY = baseScale;
		switch (state.shape) {
			case "Rectangulaire":
				scaleX *= 1.1;
				scaleY *= 0.9;
				break;
			case "Papillon":
				scaleX *= 1.15;
				scaleY *= 0.85;
				break;
			default:
				break;
		}
		const cx = bbox.x + bbox.width / 2;
		const cy = bbox.y + bbox.height / 2;
		const translateX = cx - cx * scaleX;
		const translateY = cy - cy * scaleY;
		groupLenses.setAttribute(
			"transform",
			`${lensBaseTransform} translate(${translateX} ${translateY}) scale(${scaleX} ${scaleY})`.trim()
		);
	};

	const updateSummary = () => {
		const frameLabel = state.frameTexture.label ?? state.frame.label;
		summary.textContent = `Matériau : ${state.materialLabel} • Branches : ${state.branches.label
			} • Cerclage : ${frameLabel} • Verres : ${state.lenses.label
			} • Forme : ${state.shape}`;
	};

	const applyAll = () => {
		applyBranchesColor();
		applyFrameColor();
		applyLensColor();
		applyLensScale();
		updateSummary();
	};

	let activeTextureButton: HTMLButtonElement | null = null;
	const clearTextureSelection = () => {
		if (activeTextureButton) {
			activeTextureButton.classList.remove(
				"ring-2",
				"ring-offset-2",
				"ring-[#d4c5a0]"
			);
			activeTextureButton = null;
		}
		state.frameTexture = { id: null, label: null };
	};

	const setupPalette = (container: HTMLDivElement, target: PaletteTarget) => {
		const buttons = Array.from(
			container.querySelectorAll<HTMLButtonElement>("button")
		);
		if (!buttons.length) return;
		const selectButton = (btn: HTMLButtonElement) => {
			buttons.forEach((b) => b.classList.remove("ring-2", "ring-[#d4c5a0]"));
			btn.classList.add("ring-2", "ring-[#d4c5a0]");
			state[target] = {
				value: btn.dataset.colorValue || state[target].value,
				label: btn.dataset.colorName || state[target].label,
			};
			if (target === "frame") {
				clearTextureSelection();
			}
			applyAll();
		};
		buttons.forEach((btn) => btn.addEventListener("click", () => selectButton(btn)));
		const defaultButton =
			target === "lenses" ? buttons[4] ?? buttons[0] : buttons[0];
		if (defaultButton) selectButton(defaultButton);
	};

	setupPalette(branchesPalette, "branches");
	setupPalette(framePalette, "frame");
	setupPalette(lensesPalette, "lenses");

	const ensurePattern = (id: string, imageUrl: string) => {
		let pattern = svg.querySelector<SVGPatternElement>(`#${id}`);
		if (!pattern) {
			pattern = document.createElementNS(svgNs, "pattern");
			pattern.id = id;
			pattern.setAttribute("patternUnits", "objectBoundingBox");
			pattern.setAttribute("patternContentUnits", "objectBoundingBox");
			pattern.setAttribute("width", "1");
			pattern.setAttribute("height", "1");
			const image = document.createElementNS(svgNs, "image");
			image.setAttribute("preserveAspectRatio", "xMidYMid slice");
			image.setAttribute("width", "100%");
			image.setAttribute("height", "100%");
			image.setAttribute("href", imageUrl);
			image.setAttributeNS("http://www.w3.org/1999/xlink", "href", imageUrl);
			pattern.appendChild(image);
			defs.appendChild(pattern);
		} else {
			const image = pattern.querySelector("image");
			if (image) {
				image.setAttribute("href", imageUrl);
				image.setAttributeNS("http://www.w3.org/1999/xlink", "href", imageUrl);
			}
		}
		return id;
	};

	const selectTextureButton = (
		button: HTMLButtonElement,
		patternId: string,
		label: string | null
	) => {
		if (activeTextureButton === button) return;
		clearTextureSelection();
		button.classList.add("ring-2", "ring-offset-2", "ring-[#d4c5a0]");
		activeTextureButton = button;
		state.frameTexture = { id: patternId, label };
		applyAll();
	};

	const buildMaterialsList = (
		materials: Array<{
			id: string;
			label?: string;
			imageUrl?: string | null;
			data?: { libelle?: string };
		}>
	) => {
		materialsList.innerHTML = "";
		const resetButton = document.createElement("button");
		resetButton.type = "button";
		resetButton.className =
			"flex h-20 items-center justify-center rounded-xl border border-dashed border-[#d4c5a0] bg-white text-xs font-semibold uppercase tracking-wide text-[#6b7280] transition hover:bg-[#f8f4ea]";
		resetButton.textContent = "Couleur unie";
		resetButton.addEventListener("click", () => {
			clearTextureSelection();
			applyAll();
		});
		materialsList.appendChild(resetButton);

		materials.forEach((mat) => {
			if (!mat.imageUrl) return;
			const button = document.createElement("button");
			button.type = "button";
			button.className =
				"aspect-square w-full overflow-hidden rounded-xl border border-[#e5dcc6] bg-[#faf7f0] shadow-sm transition hover:-translate-y-1 hover:shadow focus:outline-none";
			button.style.backgroundImage = `url(${mat.imageUrl})`;
			button.style.backgroundSize = "cover";
			button.style.backgroundPosition = "center";
			button.setAttribute("aria-label", `Appliquer ${mat.label ?? "une texture"}`);
			const patternId = `materiau-${mat.id}`;
			button.addEventListener("click", () => {
				ensurePattern(patternId, mat.imageUrl ?? "");
				selectTextureButton(button, patternId, mat.label ?? "Texture");
			});
			materialsList.appendChild(button);
		});
	};

	pontInput.addEventListener("input", () => {
		state.bridge = Number(pontInput.value);
		pontDisplay.textContent = `${state.bridge} mm`;
		applyFrameColor();
	});

	lensInput.addEventListener("input", () => {
		state.lensSize = Number(lensInput.value);
		lensDisplay.textContent = `${state.lensSize} mm`;
		applyLensScale();
	});

	formeSelect.addEventListener("change", () => {
		state.shape = formeSelect.value;
		applyLensScale();
		updateSummary();
	});

	materialSelect.addEventListener("change", () => {
		state.materialLabel =
			materialSelect.selectedOptions?.[0]?.textContent?.trim() ||
			state.materialLabel;
		updateSummary();
	});

	const loadMaterials = async () => {
		try {
			const res = await fetch("/api2/materiaux");
			if (!res.ok) throw new Error("Impossible de récupérer les matériaux.");
			const payload = await res.json();
			const items = (payload?.items ?? []) as Array<{
				id: string;
				label?: string;
				imageUrl?: string | null;
				data?: { libelle?: string };
			}>;
			buildMaterialsList(items);
			materialSelect.innerHTML = "";
			items.forEach((item, index) => {
				const label = item?.data?.libelle ?? item.label ?? `Matériau ${index + 1}`;
				const option = document.createElement("option");
				option.value = item.id;
				option.textContent = label;
				if (index === 0) option.selected = true;
				materialSelect.appendChild(option);
				if (item?.data?.libelle) {
					materialIdByCode[slugify(item.data.libelle)] = item.id;
				}
			});
			state.materialLabel =
				materialSelect.selectedOptions?.[0]?.textContent?.trim() ||
				state.materialLabel;
		} catch (error) {
			console.error(error);
			materialSelect.innerHTML = "";
			const fallback = document.createElement("option");
			fallback.value = "default";
			fallback.textContent = "Matériau standard";
			materialSelect.appendChild(fallback);
			state.materialLabel = fallback.textContent;
			feedback.textContent =
				error instanceof Error ? error.message : "Erreur inattendue.";
			feedback.classList.add("text-red-600");
		}
		updateSummary();
	};

	const setFeedback = (message: string, type: "error" | "success") => {
		feedback.textContent = message;
		feedback.classList.toggle("text-red-600", type === "error");
		feedback.classList.toggle("text-green-600", type === "success");
		if (type === "error") {
			feedback.classList.add("text-red-600");
			feedback.classList.remove("text-green-600");
		} else {
			feedback.classList.add("text-green-600");
			feedback.classList.remove("text-red-600");
		}
	};

	const selectColorByName = (
		container: HTMLElement | null,
		name: string | null | undefined
	) => {
		if (!container || !name) return false;
		const normalized = name.trim().toLowerCase();
		const buttons = Array.from(
			container.querySelectorAll<HTMLButtonElement>("button")
		);
		const target = buttons.find(
			(btn) => (btn.dataset.colorName ?? "").trim().toLowerCase() === normalized
		);
		if (!target) return false;
		target.click();
		return true;
	};

	const setAiFeedback = (message: string, type: "error" | "info" | "success") => {
		if (!aiFeedback) return;
		aiFeedback.textContent = message;
		const classes = {
			error: "text-red-600",
			info: "text-[#6b7280]",
			success: "text-green-600",
		} as const;
		Object.values(classes).forEach((cls) => aiFeedback.classList.remove(cls));
		aiFeedback.classList.add(classes[type]);
	};

	form.addEventListener("submit", async (event) => {
		event.preventDefault();

		const resolvedUserId = await resolveUserId();
		if (!resolvedUserId) {
			setFeedback(
				"Veuillez vous connecter pour sauvegarder vos créations.",
				"error"
			);
			return;
		}

		const trimmedName = nameInput.value.trim();
		if (!trimmedName) {
			setFeedback("Merci de nommer votre modèle avant de l'enregistrer.", "error");
			nameInput.focus();
			return;
		}

		saveButton.disabled = true;
		saveButton.textContent = "Sauvegarde…";
		setFeedback("", "success");
		feedback.classList.remove("text-green-600", "text-red-600");

		const payload = {
			name: trimmedName,
			codeSvg: encodeURIComponent(svg.outerHTML),
			largeurPont: state.bridge,
			tailleVerre: state.lensSize,
			materiauId: materialSelect.value,
			userId: resolvedUserId,
			metadata: {
				branchesColor: state.branches.value,
				frameColor: state.frame.value,
				lensesColor: state.lenses.value,
				frameTextureId: state.frameTexture.id,
				frameTextureLabel: state.frameTexture.label,
				shape: state.shape,
				materialLabel: state.materialLabel,
			},
		};

		const bodyPayload = JSON.stringify(payload);
		if (import.meta.env.DEV) {
			console.debug("[configurateur] Payload envoyé", {
				length: bodyPayload.length,
				preview: bodyPayload.slice(0, 150),
			});
		}

		try {
			const res = await fetch("/api2/save-lunette", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: bodyPayload,
			});

			const result = await res.json();
			if (!res.ok || !result?.success) {
				throw new Error(result?.error ?? "La sauvegarde a échoué.");
			}
			setFeedback("Votre création a bien été sauvegardée.", "success");
		} catch (error) {
			console.error(error);
			const message =
				error instanceof Error
					? error.message
					: "Impossible d'enregistrer pour le moment.";
			setFeedback(message, "error");
		} finally {
			saveButton.disabled = false;
			saveButton.textContent = "💾 Sauvegarder ma création";
		}
	});

	applyAll();
	void loadMaterials();

	if (aiSection && aiPrompt && aiButton && aiFeedback) {
		aiButton.addEventListener("click", async () => {
			const prompt = aiPrompt.value.trim();
			if (!prompt) {
				setAiFeedback("Décrivez vos envies avant de lancer l'IA.", "error");
				aiPrompt.focus();
				return;
			}

			aiButton.disabled = true;
			aiButton.textContent = "Génération…";
			setAiFeedback("L'IA prépare une proposition…", "info");

			try {
				const response = await fetch("/api2/generate-colors", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						prompt,
						current: {
							branches: state.branches.label,
							frame: state.frameTexture.label ?? state.frame.label,
							lenses: state.lenses.label,
						},
					}),
				});

				const payload = await response.json();
				if (!response.ok || !payload?.success) {
					throw new Error(payload?.error ?? "La génération IA a échoué.");
				}

				const colors = payload.colors as {
					branches: { name: string; value: string };
					frame: { name: string; value: string };
					lenses: { name: string; value: string };
				};

				const applied = {
					branches: selectColorByName(branchesPalette, colors?.branches?.name),
					frame: selectColorByName(framePalette, colors?.frame?.name),
					lenses: selectColorByName(lensesPalette, colors?.lenses?.name),
				};

				if (!applied.branches && !applied.frame && !applied.lenses) {
					throw new Error(
						"L'IA a proposé des couleurs indisponibles. Reformulez votre demande."
					);
				}

				const successLines = [
					"Nouvelle palette appliquée :",
					applied.branches ? `branches → ${colors.branches.name}` : null,
					applied.frame ? `monture → ${colors.frame.name}` : null,
					applied.lenses ? `verres → ${colors.lenses.name}` : null,
				].filter(Boolean);

				const successMessage = successLines.join(" ");

				setAiFeedback(
					payload.reason
						? `${successMessage}\n${payload.reason}`
						: successMessage,
					"success"
				);
				applyAll();
			} catch (error) {
				console.error("[configurateur] IA error", error);
				const message =
					error instanceof Error ? error.message : "Erreur IA inattendue.";
				setAiFeedback(message, "error");
			} finally {
				aiButton.disabled = false;
				aiButton.textContent = aiDefaultLabel;
			}
		});
	}
};

if (document.readyState === "loading") {
	document.addEventListener(
		"DOMContentLoaded",
		() => {
			try {
				initConfigurator();
			} catch (error) {
				console.error("Failed to initialise configurateur", error);
			}
		},
		{ once: true }
	);
} else {
	try {
		initConfigurator();
	} catch (error) {
		console.error("Failed to initialise configurateur", error);
	}
}
