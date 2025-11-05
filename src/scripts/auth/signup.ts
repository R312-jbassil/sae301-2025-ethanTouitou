import PocketBase from "pocketbase";

const extractPocketBaseError = (error: unknown): string => {
	const fallback =
		"Impossible de créer votre compte pour le moment. Merci de vérifier vos informations.";

	if (!error || typeof error !== "object") {
		return fallback;
}

	const errorWithData = error as {
		data?: Record<string, { message?: string } | string>;
		message?: string;
	};

	if (errorWithData.data && typeof errorWithData.data === "object") {
		const data = errorWithData.data;

		if (typeof data.message === "string") {
			return data.message;
		}

		const fieldMessages = Object.entries(data)
			.map(([field, detail]) => {
				if (detail && typeof detail === "object" && "message" in detail) {
					return `${field} : ${detail.message}`;
				}
				if (typeof detail === "string") {
					return `${field} : ${detail}`;
				}
				return null;
			})
			.filter(Boolean) as string[];

		if (fieldMessages.length) {
			return fieldMessages.join(" • ");
		}
	}

	if (typeof errorWithData.message === "string") {
		return errorWithData.message;
	}

	return fallback;
};

const initSignupForm = () => {
	const form = document.querySelector<HTMLFormElement>("#signup-form");
	if (!form) return;

	const statusElement = document.querySelector<HTMLElement>("#signup-status");
	const submitButton = form.querySelector<HTMLButtonElement>("button[type='submit']");
	const defaultLabel = submitButton?.querySelector<HTMLElement>("[data-default-label]");
	const loadingLabel = submitButton?.querySelector<HTMLElement>("[data-loading-label]");
	const toggleButtons = form.querySelectorAll<HTMLButtonElement>(
		"[data-toggle-password]"
	);

	const pocketbaseUrl =
		import.meta.env.PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090";
	const pb = new PocketBase(pocketbaseUrl);
	pb.autoCancellation(false);

	const resetStatus = () => {
		if (!statusElement) return;
		statusElement.textContent = "";
		statusElement.classList.remove("text-red-600", "text-green-600");
	};

	const setStatus = (message: string, type: "error" | "success") => {
		if (!statusElement) return;
		statusElement.textContent = message;
		statusElement.classList.toggle("text-red-600", type === "error");
		statusElement.classList.toggle("text-green-600", type === "success");
	};

	toggleButtons.forEach((button) => {
		button.addEventListener("click", () => {
			const targetId = button.getAttribute("data-toggle-password");
			if (!targetId) return;

			const targetInput = form.querySelector<HTMLInputElement>(`#${targetId}`);
			if (!targetInput) return;

			const isPassword = targetInput.type === "password";
			targetInput.type = isPassword ? "text" : "password";
			button.textContent = isPassword ? "Masquer" : "Afficher";
			targetInput.focus();
		});
	});

	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		resetStatus();

		const nameInput = form.querySelector<HTMLInputElement>("#name");
		const emailInput = form.querySelector<HTMLInputElement>("#email");
		const passwordInput = form.querySelector<HTMLInputElement>("#password");
		const passwordConfirmInput =
			form.querySelector<HTMLInputElement>("#passwordConfirm");
		const avatarInput = form.querySelector<HTMLInputElement>("#avatar");

		if (!emailInput || !passwordInput || !passwordConfirmInput) {
			setStatus("Formulaire incomplet. Merci de réessayer.", "error");
			return;
		}

		const email = emailInput.value.trim();
		const password = passwordInput.value;
		const passwordConfirm = passwordConfirmInput.value;
		const name = nameInput?.value.trim() ?? "";
		const avatarFile = avatarInput?.files?.[0] ?? null;

		if (!email || !password || !passwordConfirm) {
			setStatus("Merci de renseigner votre email et un mot de passe.", "error");
			return;
		}

		if (password.length < 8) {
			setStatus("Votre mot de passe doit contenir au moins 8 caractères.", "error");
			return;
		}

		if (password !== passwordConfirm) {
			setStatus("Les deux mots de passe ne correspondent pas.", "error");
			return;
		}

		const formData = new FormData();
		formData.append("email", email);
		formData.append("password", password);
		formData.append("passwordConfirm", passwordConfirm);
		formData.append("emailVisibility", "true");
		formData.append("verified", "false");

		const baseUsername =
			name ||
			(email.includes("@") ? email.split("@")[0] : `user${Date.now().toString(36)}`);
		const normalizedUsername = baseUsername
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "")
			.trim();

		if (normalizedUsername) {
			formData.append(
				"username",
				`${normalizedUsername}${Math.random().toString(36).slice(-4)}`
			);
		}

		if (name) {
			formData.append("name", name);
		}

		if (avatarFile) {
			formData.append("avatar", avatarFile);
		}

		if (submitButton && defaultLabel && loadingLabel) {
			submitButton.disabled = true;
			defaultLabel.classList.add("hidden");
			loadingLabel.classList.remove("hidden");
		}

		try {
			await pb.collection("users").create(formData);
			await pb.collection("users").authWithPassword(email, password);

			setStatus("Compte créé ! Bienvenue chez TaVue.", "success");

			window.setTimeout(() => {
				window.location.assign("/");
			}, 1200);
		} catch (error) {
			console.error("PocketBase signup error", error);
			setStatus(extractPocketBaseError(error), "error");
		} finally {
			if (submitButton && defaultLabel && loadingLabel) {
				submitButton.disabled = false;
				defaultLabel.classList.remove("hidden");
				loadingLabel.classList.add("hidden");
			}
		}
	});
};

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initSignupForm, { once: true });
} else {
	initSignupForm();
}
