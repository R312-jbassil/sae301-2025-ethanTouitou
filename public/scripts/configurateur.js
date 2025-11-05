(() => {
	const root = document.querySelector('[data-configurator]');
	if (!root) return;

	const svgWrapper = root.querySelector('[data-svg-wrapper]');
	const svg = svgWrapper?.querySelector('svg');
	if (!svg) {
		console.warn('[configurateur] SVG introuvable.');
		return;
	}

	const groupBranches = svg.querySelector('#branches');
	const groupFrame = svg.querySelector('#monture');
	const groupLenses = svg.querySelector('#verres');
	if (!groupBranches || !groupFrame || !groupLenses) {
		console.warn('[configurateur] Groupes branches/monture/verres manquants.');
		return;
	}

	const lensBaseTransform = groupLenses.getAttribute('transform') ?? '';

	const materialSelect = root.querySelector('[data-materiau]');
	const formeSelect = root.querySelector("select[name='forme']");
	const branchesPalette = root.querySelector('[data-color-branches]');
	const framePalette = root.querySelector('[data-color-frame]');
	const lensesPalette = root.querySelector('[data-color-lenses]');
	const materialsList = root.querySelector('[data-materials-list]');
	const pontInput = root.querySelector("input[name='largeurPont']");
	const lensInput = root.querySelector("input[name='tailleVerre']");
	const pontDisplay = root.querySelector('[data-pont-value]');
	const lensDisplay = root.querySelector('[data-verre-value]');
	const summary = root.querySelector('[data-summary]');
	const feedback = root.querySelector('[data-feedback]');
	const form = root.querySelector('[data-config-form]');
	const saveButton = form?.querySelector('[data-save]');

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
		!saveButton
	) {
		console.warn('[configurateur] éléments de formulaire manquants.');
		return;
	}

	const hexToRgba = (hex, alpha = 1) => {
		const normalized = hex.replace('#', '');
		const int = parseInt(normalized, 16);
		const r = (int >> 16) & 255;
		const g = (int >> 8) & 255;
		const b = int & 255;
		return `rgba(${r}, ${g}, ${b}, ${alpha})`;
	};

	const paletteButtonColor = (button) => ({
		value: button.dataset.colorValue || '#1f1f1f',
		label: button.dataset.colorName || 'Couleur'
	});

	const firstBranchColor = paletteButtonColor(
		branchesPalette.querySelector('button') ?? document.createElement('button')
	);
	const firstFrameColor = paletteButtonColor(
		framePalette.querySelector('button') ?? document.createElement('button')
	);
	const defaultLensButton = lensesPalette.querySelectorAll('button')[4] ?? lensesPalette.querySelector('button');
	const firstLensColor = paletteButtonColor(defaultLensButton ?? document.createElement('button'));

	const defs = svg.querySelector('defs') ?? svg.insertBefore(document.createElementNS('http://www.w3.org/2000/svg', 'defs'), svg.firstChild);

	const state = {
		branches: firstBranchColor,
		frame: firstFrameColor,
		lenses: firstLensColor,
		frameTexture: { id: null, label: null },
		bridge: Number(pontInput.value) || 20,
		lensSize: Number(lensInput.value) || 50,
		shape: formeSelect.value || 'Rectangulaire',
		materialLabel: materialSelect.selectedOptions?.[0]?.textContent?.trim() || 'Matériau'
	};

	const pocketbaseUrl =
		root.dataset.pocketbaseUrl && root.dataset.pocketbaseUrl.length > 0
			? root.dataset.pocketbaseUrl
			: 'http://127.0.0.1:8090';
	const userId = root.dataset.userId || 'ID_DU_USER_A_REMPLACER';

	const materialIdByCode = {};

	const slugify = (value) =>
		value
			.toString()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '');

	const applyBranchesColor = () => {
		svg.style.setProperty('--color-branches', state.branches.value);
	};

	const applyFrameColor = () => {
		const fillValue = state.frameTexture.id ? `url(#${state.frameTexture.id})` : state.frame.value;
		svg.style.setProperty('--color-frame', state.frame.value);
		const strokeWidth = Math.max(0.5, state.bridge / 4);
		groupFrame.querySelectorAll('path').forEach((path) => {
			path.setAttribute('fill', fillValue);
			path.setAttribute('stroke', state.frame.value);
			path.setAttribute('stroke-width', strokeWidth.toString());
		});
	};

	const applyLensColor = () => {
		const rgba = hexToRgba(state.lenses.value, 0.45);
		svg.style.setProperty('--color-lenses', rgba);
	};

	const applyLensScale = () => {
		const bbox = groupLenses.getBBox();
		const baseScale = state.lensSize / 50;
		let scaleX = baseScale;
		let scaleY = baseScale;
		switch (state.shape) {
			case 'Rectangulaire':
				scaleX *= 1.1;
				scaleY *= 0.9;
				break;
			case 'Papillon':
				scaleX *= 1.15;
				scaleY *= 0.85;
				break;
		}
		const cx = bbox.x + bbox.width / 2;
		const cy = bbox.y + bbox.height / 2;
		const translateX = cx - cx * scaleX;
		const translateY = cy - cy * scaleY;
		groupLenses.setAttribute(
			'transform',
			`${lensBaseTransform} translate(${translateX} ${translateY}) scale(${scaleX} ${scaleY})`.trim()
		);
	};

	const updateSummary = () => {
		const frameLabel = state.frameTexture.label ?? state.frame.label;
		summary.textContent = `Matériau : ${state.materialLabel} • Branches : ${state.branches.label} • Cerclage : ${frameLabel} • Verres : ${state.lenses.label} • Forme : ${state.shape}`;
	};

	const applyAll = () => {
		applyBranchesColor();
		applyFrameColor();
		applyLensColor();
		applyLensScale();
		updateSummary();
	};

	let activeTextureButton = null;
	const clearTextureSelection = () => {
		if (activeTextureButton) {
			activeTextureButton.classList.remove('ring-2', 'ring-offset-2', 'ring-[#d4c5a0]');
			activeTextureButton = null;
		}
		state.frameTexture = { id: null, label: null };
	};

	const setupPalette = (container, target) => {
		const buttons = Array.from(container.querySelectorAll('button'));
		if (!buttons.length) return;
		const selectButton = (btn) => {
			buttons.forEach((b) => b.classList.remove('ring-2', 'ring-[#d4c5a0]'));
			btn.classList.add('ring-2', 'ring-[#d4c5a0]');
			state[target] = {
				value: btn.dataset.colorValue || state[target].value,
				label: btn.dataset.colorName || state[target].label
			};
			if (target === 'frame') {
				clearTextureSelection();
			}
			applyAll();
		};
		buttons.forEach((btn) => btn.addEventListener('click', () => selectButton(btn)));
		const defaultButton = target === 'lenses' ? buttons[4] ?? buttons[0] : buttons[0];
		if (defaultButton) selectButton(defaultButton);
	};

	setupPalette(branchesPalette, 'branches');
	setupPalette(framePalette, 'frame');
	setupPalette(lensesPalette, 'lenses');

	const ensurePattern = (id, imageUrl) => {
		let pattern = svg.querySelector(`#${id}`);
		if (!pattern) {
			pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
			pattern.id = id;
			pattern.setAttribute('patternUnits', 'objectBoundingBox');
			pattern.setAttribute('patternContentUnits', 'objectBoundingBox');
			pattern.setAttribute('width', '1');
			pattern.setAttribute('height', '1');
			const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
			image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
			image.setAttribute('width', '100%');
			image.setAttribute('height', '100%');
			image.setAttribute('href', imageUrl);
			image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imageUrl);
			pattern.appendChild(image);
			defs.appendChild(pattern);
		} else {
			const image = pattern.querySelector('image');
			if (image) {
				image.setAttribute('href', imageUrl);
				image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imageUrl);
			}
		}
		return id;
	};

	const selectTextureButton = (button, patternId, label) => {
		if (activeTextureButton === button) return;
		clearTextureSelection();
		button.classList.add('ring-2', 'ring-offset-2', 'ring-[#d4c5a0]');
		activeTextureButton = button;
		state.frameTexture = { id: patternId, label };
		applyAll();
	};

	const buildMaterialsList = (materials) => {
		materialsList.innerHTML = '';
		const resetButton = document.createElement('button');
		resetButton.type = 'button';
		resetButton.className = 'flex h-20 items-center justify-center rounded-xl border border-dashed border-[#d4c5a0] bg-white text-xs font-semibold uppercase tracking-wide text-[#6b7280] transition hover:bg-[#f8f4ea]';
		resetButton.textContent = 'Couleur unie';
		resetButton.addEventListener('click', () => {
			clearTextureSelection();
			applyAll();
		});
		materialsList.appendChild(resetButton);

		materials.forEach((mat) => {
			if (!mat.imageUrl) return;
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'aspect-square w-full overflow-hidden rounded-xl border border-[#e5dcc6] bg-[#faf7f0] shadow-sm transition hover:-translate-y-1 hover:shadow focus:outline-none';
			button.style.backgroundImage = `url(${mat.imageUrl})`;
			button.style.backgroundSize = 'cover';
			button.style.backgroundPosition = 'center';
			button.setAttribute('aria-label', `Appliquer ${mat.label}`);
			const patternId = `materiau-${mat.id}`;
			button.addEventListener('click', () => {
				ensurePattern(patternId, mat.imageUrl);
				selectTextureButton(button, patternId, mat.label ?? 'Texture');
			});
			materialsList.appendChild(button);
		});
	};

	pontInput.addEventListener('input', () => {
		state.bridge = Number(pontInput.value);
		pontDisplay.textContent = `${state.bridge} mm`;
		applyFrameColor();
	});

	lensInput.addEventListener('input', () => {
		state.lensSize = Number(lensInput.value);
		lensDisplay.textContent = `${state.lensSize} mm`;
		applyLensScale();
	});

	formeSelect.addEventListener('change', () => {
		state.shape = formeSelect.value;
		applyLensScale();
		updateSummary();
	});

	materialSelect.addEventListener('change', () => {
		state.materialLabel = materialSelect.selectedOptions?.[0]?.textContent?.trim() || state.materialLabel;
		updateSummary();
	});

	const loadMaterials = async () => {
		try {
			const res = await fetch('/api/materiaux');
			if (!res.ok) throw new Error("Impossible de récupérer les matériaux.");
			const payload = await res.json();
			const items = payload?.items ?? [];
			buildMaterialsList(items);
			materialSelect.innerHTML = '';
			items.forEach((item, index) => {
				const label = item?.data?.libelle ?? item.label ?? `Matériau ${index + 1}`;
				const option = document.createElement('option');
				option.value = item.id;
				option.textContent = label;
				if (index === 0) option.selected = true;
				materialSelect.appendChild(option);
				if (item?.data?.libelle) {
					materialIdByCode[slugify(item.data.libelle)] = item.id;
				}
			});
			state.materialLabel = materialSelect.selectedOptions?.[0]?.textContent?.trim() || state.materialLabel;
		} catch (error) {
			console.error(error);
			materialSelect.innerHTML = '';
			const fallback = document.createElement('option');
			fallback.value = 'default';
			fallback.textContent = 'Matériau standard';
			materialSelect.appendChild(fallback);
			state.materialLabel = fallback.textContent;
			feedback.textContent = error instanceof Error ? error.message : 'Erreur inattendue.';
			feedback.classList.add('text-red-600');
		}
		updateSummary();
	};

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!userId || userId === 'ID_DU_USER_A_REMPLACER') {
            feedback.textContent = "Impossible de sauvegarder tant que l'utilisateur courant n'est pas défini.";
            feedback.classList.add('text-red-600');
            return;
		}

		saveButton.disabled = true;
		saveButton.textContent = 'Sauvegarde…';
		feedback.textContent = '';
		feedback.classList.remove('text-red-600', 'text-green-600');

		const payload = {
			codeSvg: svg.outerHTML,
			largeurPont: state.bridge,
			tailleVerre: state.lensSize,
			materiauId: materialSelect.value,
			userId
		};

		try {
			const res = await fetch('/api/save-lunette', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			const result = await res.json();
			if (!res.ok || !result?.success) {
				throw new Error(result?.error ?? 'La sauvegarde a échoué.');
			}
			feedback.textContent = 'Votre création a bien été sauvegardée.';
			feedback.classList.add('text-green-600');
		} catch (error) {
			console.error(error);
			feedback.textContent =
				error instanceof Error ? error.message : "Impossible d'enregistrer pour le moment.";
			feedback.classList.add('text-red-600');
		} finally {
			saveButton.disabled = false;
			saveButton.textContent = '💾 Sauvegarder ma création';
		}
	});

    applyAll();
    void loadMaterials();
})();
