#!/usr/bin/env node
import { extractTextItems, getDocumentProxy } from 'unpdf';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  execFileAsync,
  optionValue,
  readSortedPdfFileNames,
  repoRoot,
  unknownErrorMessage,
} from './lib/sample-script-helpers.mjs';
import {
  createSourceCoverageReport,
  createSourceSegmentsFromLayoutText,
} from './lib/source-coverage-helpers.mjs';

const commandMaxBuffer = 64 * 1024 * 1024;
const renderScale = 2;
const usageText = `
Usage:
  node scripts/inspect-pdf-source.mjs <pdf-file> [more-pdfs...] [--output <dir>]
  node scripts/inspect-pdf-source.mjs --samples <dir> [--output <dir>]

Writes a PDF source evidence bundle with Poppler text, pdfplumber geometry,
raw unpdf items, parser structural lines, rendered page PNGs, and an HTML box
overlay. Run pnpm run build first, or use the package script that builds first.
`;

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stdout.write(usageText);
  process.exit(0);
}

const outputOption = optionValue('--output');
const samplesOption = optionValue('--samples');
const pdfPaths = await resolvePdfPaths();

if (pdfPaths.length === 0) {
  throw new Error(`No PDF files provided.\n${usageText}`);
}

const bundleSummaries = [];

for (const [index, pdfPath] of pdfPaths.entries()) {
  const outputDir = resolveBundleOutputDir({
    outputOption,
    pdfPath,
    totalPdfCount: pdfPaths.length,
  });

  bundleSummaries.push(
    await inspectPdf({ outputDir, pdfPath, sequence: index })
  );
}

console.log(
  bundleSummaries
    .map(summary => {
      const failureText =
        summary.failureCount === 0
          ? 'no failures'
          : `${summary.failureCount} failure(s)`;

      return `Wrote ${summary.pdfFileName} source bundle to ${path.relative(
        repoRoot,
        summary.outputDir
      )} (${failureText}).`;
    })
    .join('\n')
);

async function resolvePdfPaths() {
  if (samplesOption !== undefined) {
    const samplesDir = path.resolve(repoRoot, samplesOption);
    const pdfFileNames = await readSortedPdfFileNames(
      samplesDir,
      `No PDF files found in ${samplesDir}`
    );

    return pdfFileNames.map(pdfFileName => path.join(samplesDir, pdfFileName));
  }

  return positionalArgs().map(pdfPath => path.resolve(repoRoot, pdfPath));
}

function positionalArgs() {
  const args = [];
  const optionsWithValues = new Set(['--output', '--samples']);

  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];

    if (optionsWithValues.has(arg)) {
      index += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      continue;
    }

    args.push(arg);
  }

  return args;
}

function resolveBundleOutputDir({ outputOption, pdfPath, totalPdfCount }) {
  const outputRoot =
    outputOption === undefined
      ? path.join(repoRoot, '.debug')
      : path.resolve(repoRoot, outputOption);
  const safeStem = safeFileStem(pdfPath);

  if (outputOption !== undefined && totalPdfCount === 1) {
    return outputRoot;
  }

  return path.join(outputRoot, safeStem);
}

async function inspectPdf({ outputDir, pdfPath, sequence }) {
  const pdfFileName = path.basename(pdfPath);
  const files = [];
  const failures = [];

  await fs.mkdir(outputDir, { recursive: true });

  const pdfBuffer = await fs.readFile(pdfPath);
  const popplerArtifacts = await writePopplerArtifacts({
    failures,
    files,
    outputDir,
    pdfPath,
  });
  const unpdfArtifacts = await writeUnpdfArtifacts({
    failures,
    files,
    outputDir,
    pdfBuffer,
  });
  const parserArtifacts = await writeParserArtifacts({
    failures,
    files,
    outputDir,
    pdfBuffer,
  });

  await writePdfplumberArtifacts({
    failures,
    files,
    outputDir,
    pdfPath,
  });

  await writeSourceSegmentArtifacts({
    failures,
    files,
    layoutText: popplerArtifacts.layoutText,
    outputDir,
    parserOutput: parserArtifacts.parserOutput,
    pdfFileName,
    pdfPath,
  });

  await writeOverlayHtml({
    files,
    outputDir,
    pageImages: popplerArtifacts.pageImages,
    parserLayout: parserArtifacts.parserLayout,
    unpdfPages: unpdfArtifacts.pages,
  });

  await writeJsonFile({
    data: {
      generatedAt: new Date().toISOString(),
      pdfFileName,
      pdfPath: path.relative(repoRoot, pdfPath),
      outputDir: path.relative(repoRoot, outputDir),
      sequence,
      files,
      failures,
    },
    files,
    outputDir,
    relativePath: 'manifest.json',
  });

  return {
    failureCount: failures.length,
    outputDir,
    pdfFileName,
  };
}

async function writePopplerArtifacts({ failures, files, outputDir, pdfPath }) {
  const layoutText = await writeCommandStdout({
    args: ['-layout', pdfPath, '-'],
    command: 'pdftotext',
    failures,
    files,
    outputDir,
    relativePath: 'poppler.layout.txt',
  });
  await writeCommandStdout({
    args: ['-raw', pdfPath, '-'],
    command: 'pdftotext',
    failures,
    files,
    outputDir,
    relativePath: 'poppler.raw.txt',
  });
  await writeCommandStdout({
    args: ['-bbox-layout', pdfPath, '-'],
    command: 'pdftotext',
    failures,
    files,
    outputDir,
    relativePath: 'poppler.bbox.xhtml',
  });
  await writeCommandStdout({
    args: [pdfPath],
    command: 'pdfinfo',
    failures,
    files,
    outputDir,
    relativePath: 'pdfinfo.txt',
  });
  await writeCommandStdout({
    args: [pdfPath],
    command: 'pdffonts',
    failures,
    files,
    outputDir,
    relativePath: 'pdffonts.txt',
  });
  await writeCommandStdout({
    args: ['-list', pdfPath],
    command: 'pdfimages',
    failures,
    files,
    outputDir,
    relativePath: 'pdfimages.txt',
  });

  const pageImages = await renderPageImages({
    failures,
    files,
    outputDir,
    pdfPath,
  });

  return {
    layoutText,
    pageImages,
  };
}

async function renderPageImages({ failures, files, outputDir, pdfPath }) {
  const pagePrefix = path.join(outputDir, 'page');

  try {
    await execFileAsync(
      'pdftoppm',
      ['-png', '-r', String(72 * renderScale), pdfPath, pagePrefix],
      { maxBuffer: commandMaxBuffer }
    );
  } catch (error) {
    await writeFailureFile({
      artifact: 'rendered page PNGs',
      error,
      failures,
      outputDir,
      relativePath: 'page-render-error.txt',
    });

    return [];
  }

  const pageImages = (await fs.readdir(outputDir))
    .filter(fileName => /^page-\d+\.png$/.test(fileName))
    .sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true })
    );

  for (const pageImage of pageImages) {
    files.push(pageImage);
  }

  return pageImages;
}

async function writeUnpdfArtifacts({ failures, files, outputDir, pdfBuffer }) {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const pageDimensions = await readPageDimensions(pdf);
    const { items } = await extractTextItems(pdf);
    const pages = items.map((pageItems, pageIndex) => ({
      height: pageDimensions[pageIndex]?.height,
      items: pageItems,
      pageIndex,
      pageNumber: pageIndex + 1,
      width: pageDimensions[pageIndex]?.width,
    }));

    await writeJsonFile({
      data: {
        pageCount: pages.length,
        pages,
      },
      files,
      outputDir,
      relativePath: 'unpdf.items.json',
    });

    return { pages };
  } catch (error) {
    await writeFailureFile({
      artifact: 'unpdf.items.json',
      error,
      failures,
      outputDir,
      relativePath: 'unpdf-error.txt',
    });

    return { pages: [] };
  }
}

async function readPageDimensions(pdf) {
  const pageDimensions = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });

    pageDimensions.push({
      height: viewport.height,
      width: viewport.width,
    });
  }

  return pageDimensions;
}

async function writeParserArtifacts({ failures, files, outputDir, pdfBuffer }) {
  try {
    const parserModule = await import(
      pathToFileURL(path.join(repoRoot, 'dist', 'index.js')).href
    );
    const sourceDebug =
      await parserModule.extractLinkedInPDFSourceDebug(pdfBuffer);
    const parserOutput = await parserModule.parseLinkedInPDF(pdfBuffer, {
      includeRawText: true,
    });

    await writeJsonFile({
      data: sourceDebug,
      files,
      outputDir,
      relativePath: 'parser.structural.json',
    });
    await writeJsonFile({
      data: sourceDebug.structuralLines,
      files,
      outputDir,
      relativePath: 'parser-lines.json',
    });
    await writeJsonFile({
      data: parserOutput,
      files,
      outputDir,
      relativePath: 'parser-output.json',
    });

    return {
      parserLayout: sourceDebug.layout,
      parserOutput,
    };
  } catch (error) {
    await writeFailureFile({
      artifact: 'parser artifacts',
      error,
      failures,
      outputDir,
      relativePath: 'parser-error.txt',
    });

    return {
      parserLayout: undefined,
      parserOutput: undefined,
    };
  }
}

async function writePdfplumberArtifacts({
  failures,
  files,
  outputDir,
  pdfPath,
}) {
  const pythonScript = `
import json
import sys
import pdfplumber

pdf_path = sys.argv[1]
pages = []
with pdfplumber.open(pdf_path) as pdf:
    for page_index, page in enumerate(pdf.pages):
        pages.append({
            "pageIndex": page_index,
            "pageNumber": page_index + 1,
            "width": page.width,
            "height": page.height,
            "words": page.extract_words(extra_attrs=["fontname", "size"]),
            "chars": page.chars,
        })
json.dump({"pageCount": len(pages), "pages": pages}, sys.stdout)
`;

  let parsedOutput;

  try {
    const { stdout } = await execFileAsync(
      'uvx',
      ['--from', 'pdfplumber', 'python', '-c', pythonScript, pdfPath],
      { maxBuffer: commandMaxBuffer }
    );

    parsedOutput = JSON.parse(stdout);
  } catch (error) {
    await writeFailureFile({
      artifact: 'pdfplumber artifacts',
      error,
      failures,
      outputDir,
      relativePath: 'pdfplumber-error.txt',
    });

    return;
  }

  await writeJsonFile({
    data: {
      pageCount: parsedOutput.pageCount,
      pages: parsedOutput.pages.map(page => ({
        height: page.height,
        pageIndex: page.pageIndex,
        pageNumber: page.pageNumber,
        width: page.width,
        words: page.words,
      })),
    },
    files,
    outputDir,
    relativePath: 'pdfplumber.words.json',
  });
  await writeJsonFile({
    data: {
      pageCount: parsedOutput.pageCount,
      pages: parsedOutput.pages.map(page => ({
        chars: page.chars,
        height: page.height,
        pageIndex: page.pageIndex,
        pageNumber: page.pageNumber,
        width: page.width,
      })),
    },
    files,
    outputDir,
    relativePath: 'pdfplumber.chars.json',
  });
}

async function writeSourceSegmentArtifacts({
  failures,
  files,
  layoutText,
  outputDir,
  parserOutput,
  pdfFileName,
  pdfPath,
}) {
  if (layoutText === undefined) {
    return;
  }

  const sourceView = createSourceSegmentsFromLayoutText(layoutText);

  await writeJsonFile({
    data: sourceView,
    files,
    outputDir,
    relativePath: 'source-segments.json',
  });

  if (parserOutput !== undefined) {
    await writeJsonFile({
      data: createSourceCoverageReport({
        layoutText,
        parsedJson: parserOutput,
        pdfFileName,
      }),
      files,
      outputDir,
      relativePath: 'parser-source-coverage.json',
    });
  }

  const baselineJsonPath = replaceExtension(pdfPath, '.json');

  try {
    const baselineJson = JSON.parse(
      await fs.readFile(baselineJsonPath, 'utf8')
    );

    await writeJsonFile({
      data: createSourceCoverageReport({
        layoutText,
        parsedJson: baselineJson,
        pdfFileName,
      }),
      files,
      outputDir,
      relativePath: 'baseline-source-coverage.json',
    });
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      await writeFailureFile({
        artifact: 'baseline-source-coverage.json',
        error,
        failures,
        outputDir,
        relativePath: 'baseline-source-coverage-error.txt',
      });
    }
  }
}

async function writeOverlayHtml({
  files,
  outputDir,
  pageImages,
  parserLayout,
  unpdfPages,
}) {
  const html = createOverlayHtml({
    pageImages,
    parserLayout,
    unpdfPages,
  });

  await writeTextFile({
    content: html,
    files,
    outputDir,
    relativePath: 'overlay.html',
  });
}

function createOverlayHtml({ pageImages, parserLayout, unpdfPages }) {
  const pageSections = unpdfPages
    .map((page, pageIndex) =>
      createPageOverlayHtml({
        imageName: pageImages[pageIndex],
        page,
        parserLayout,
      })
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>PDF Source Overlay</title>
<style>
body { margin: 24px; font-family: system-ui, sans-serif; background: #f5f5f5; color: #222; }
.page { position: relative; margin: 0 0 32px; background: white; box-shadow: 0 2px 10px rgb(0 0 0 / 18%); }
.page img, .page svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.page img { z-index: 1; }
.page svg { z-index: 2; }
.item rect { fill: rgb(0 125 255 / 10%); stroke: rgb(0 92 204 / 55%); stroke-width: 1; }
.item.sidebar rect { fill: rgb(245 138 7 / 13%); stroke: rgb(189 89 0 / 60%); }
.item text { fill: rgb(0 0 0 / 65%); font: 8px ui-monospace, SFMono-Regular, Menlo, monospace; pointer-events: none; }
.missing-image { position: absolute; inset: 0; display: grid; place-items: center; color: #666; z-index: 1; }
</style>
</head>
<body>
${pageSections}
</body>
</html>
`;
}

function createPageOverlayHtml({ imageName, page, parserLayout }) {
  const width = Number(page.width ?? 612);
  const height = Number(page.height ?? 792);
  const scaledWidth = width * renderScale;
  const scaledHeight = height * renderScale;
  const items = page.items
    .filter(item => item.str.trim().length > 0)
    .map(item => createItemOverlayHtml({ height, item, parserLayout }))
    .join('\n');
  const imageHtml =
    imageName === undefined
      ? '<div class="missing-image">Rendered page image unavailable</div>'
      : `<img src="${escapeHtml(imageName)}" alt="Rendered PDF page ${page.pageNumber}">`;

  return `<section class="page" style="width:${scaledWidth}px;height:${scaledHeight}px">
${imageHtml}
<svg viewBox="0 0 ${scaledWidth} ${scaledHeight}" aria-label="Text item overlay">
${items}
</svg>
</section>`;
}

function createItemOverlayHtml({ height, item, parserLayout }) {
  const x = item.x * renderScale;
  const y = Math.max(0, (height - item.y - item.height) * renderScale);
  const width = Math.max(1, item.width * renderScale);
  const itemHeight = Math.max(1, item.height * renderScale);
  const columnClass =
    parserLayout?.type === 'two-column' &&
    parserLayout.mainBounds !== undefined &&
    item.x < parserLayout.mainBounds.left
      ? ' sidebar'
      : '';

  return `<g class="item${columnClass}">
<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(
    width
  )}" height="${formatNumber(itemHeight)}"></rect>
<text x="${formatNumber(x)}" y="${formatNumber(
    y + itemHeight + 8
  )}">${escapeHtml(item.str)}</text>
</g>`;
}

async function writeCommandStdout({
  args,
  command,
  failures,
  files,
  outputDir,
  relativePath,
}) {
  try {
    const { stdout } = await execFileAsync(command, args, {
      maxBuffer: commandMaxBuffer,
    });

    await writeTextFile({
      content: stdout,
      files,
      outputDir,
      relativePath,
    });

    return stdout;
  } catch (error) {
    await writeFailureFile({
      artifact: relativePath,
      error,
      failures,
      outputDir,
      relativePath: replaceExtension(relativePath, '.error.txt'),
    });

    return undefined;
  }
}

async function writeJsonFile({ data, files, outputDir, relativePath }) {
  await writeTextFile({
    content: `${JSON.stringify(data, null, 2)}\n`,
    files,
    outputDir,
    relativePath,
  });
}

async function writeTextFile({ content, files, outputDir, relativePath }) {
  await fs.writeFile(path.join(outputDir, relativePath), content);
  files.push(relativePath);
}

async function writeFailureFile({
  artifact,
  error,
  failures,
  outputDir,
  relativePath,
}) {
  const message = unknownErrorMessage(error);

  failures.push({
    artifact,
    message,
  });
  await fs.writeFile(path.join(outputDir, relativePath), `${message}\n`);
}

function replaceExtension(filePath, extension) {
  return `${filePath.slice(0, -path.extname(filePath).length)}${extension}`;
}

function safeFileStem(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

function formatNumber(value) {
  return Number(value).toFixed(2);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
