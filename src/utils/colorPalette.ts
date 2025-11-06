export type ColorOption = {
	name: string;
	value: string;
};

export const COLOR_PALETTE: ReadonlyArray<ColorOption> = [
	{ name: "Noir", value: "#1f1f1f" },
	{ name: "Anthracite", value: "#3a3a3a" },
	{ name: "Beige", value: "#d4c5a0" },
	{ name: "Écaille", value: "#a5653f" },
	{ name: "Ivoire", value: "#f5f1e6" },
	{ name: "Bleu", value: "#5678ff" },
	{ name: "Vert", value: "#4caf50" },
	{ name: "Rouge", value: "#e03d3d" },
	{ name: "Rose", value: "#eaa0b5" },
];

export const findColorByName = (name: string) => {
	const normalized = name.trim().toLowerCase();
	return COLOR_PALETTE.find(
		(entry) => entry.name.trim().toLowerCase() === normalized
	);
};

