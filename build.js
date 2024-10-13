import fs from "node:fs";
import path from "node:path";
import { minify } from "html-minifier";
import sharp from "sharp";
import fse from "fs-extra";
import { fileURLToPath } from "node:url";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, "src");
const distDir = path.join(__dirname, "dist");

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir);
}

// Function to resize images based on HTML attributes and compress them
async function resizeImages(html) {
	const imgRegex =
		/<img[^>]+src="([^">]+)"[^>]+width="([^">]+)"[^>]+height="([^">]+)"[^>]*>/g;
	let match = imgRegex.exec(html);

	while (match !== null) {
		const imgSrc = match[1];
		const width = Number.parseInt(match[2], 10);
		const height = Number.parseInt(match[3], 10);

		const srcPath = path.join(srcDir, imgSrc);
		const distPath = path.join(distDir, imgSrc);

		if (fs.existsSync(srcPath)) {
			console.log(`Resizing and compressing ${imgSrc} to ${width}x${height}`);

			const sharpInstance = sharp(srcPath).resize(width, height);

			// Use appropriate compression based on image type
			if (imgSrc.endsWith(".jpg") || imgSrc.endsWith(".jpeg")) {
				await sharpInstance.jpeg({ quality: 75 }).toFile(distPath);
			} else if (imgSrc.endsWith(".png")) {
				await sharpInstance.png({ quality: 80 }).toFile(distPath);
			} else {
				await sharpInstance.toFile(distPath); // For other formats
			}
		}

		// Get the next match
		match = imgRegex.exec(html);
	}
}

// Function to compress non-resized images using sharp
async function compressImages() {
	const imageDir = path.join(srcDir, "images");
	const distImageDir = path.join(distDir, "images");

	if (!fs.existsSync(imageDir)) return;

	const images = fs.readdirSync(imageDir);

	for (const img of images) {
		const srcPath = path.join(imageDir, img);
		const distPath = path.join(distImageDir, img);

		if (!fs.existsSync(distPath)) {
			// Only compress if image wasn't resized
			console.log(`Compressing ${img}`);
			const sharpInstance = sharp(srcPath);

			if (img.endsWith(".jpg") || img.endsWith(".jpeg")) {
				await sharpInstance.jpeg({ quality: 75 }).toFile(distPath);
			} else if (img.endsWith(".png")) {
				await sharpInstance.png({ quality: 80 }).toFile(distPath);
			} else {
				await sharpInstance.toFile(distPath); // For other formats
			}
		}
	}
}

// Read component files and inject them into index.html
async function buildHTML() {
	let html = fs.readFileSync(path.join(srcDir, "index.html"), "utf-8");

	const componentRegex = /<component src="(.*)"><\/component>/g;
	html = html.replace(componentRegex, (_, componentPath) => {
		const component = fs.readFileSync(
			path.join(srcDir, "components", componentPath),
			"utf-8",
		);
		return component;
	});

	// Minify HTML
	const minifiedHTML = minify(html, {
		collapseWhitespace: true,
		removeComments: true,
		minifyCSS: true,
		minifyJS: true,
	});

	// Resize and compress images before saving final HTML
	await resizeImages(minifiedHTML);

	fs.writeFileSync(path.join(distDir, "index.html"), minifiedHTML);
}

// Copy all files from /src/assets to /dist/assets, and root style/script files to /dist
function copyAssets() {
	const assetsSrc = path.join(srcDir, "assets");
	const assetsDist = path.join(distDir, "assets");

	// Copy assets folder
	if (fs.existsSync(assetsSrc)) {
		fse.copySync(assetsSrc, assetsDist);
		console.log(`Copied assets from ${assetsSrc} to ${assetsDist}`);
	}

	// Copy root CSS and JS files
	const filesToCopy = ["styles.css", "script.js"];
	for (const file in filesToCopy) {
		const srcFile = path.join(srcDir, file);
		const distFile = path.join(distDir, file);

		if (fs.existsSync(srcFile)) {
			fs.copyFileSync(srcFile, distFile);
			console.log(`Copied ${file} to ${distDir}`);
		}
	}
}

// Run build process with top-level await (Node.js 14+ supports it)
(async () => {
	await buildHTML();
	copyAssets();
	await compressImages(); // Compress non-resized images after build
	console.log("Build completed!");
})();
