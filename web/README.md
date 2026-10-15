# Larry for websites

Larry's existing Fortn.ee artwork and interactions, packaged for reuse. No runtime
dependencies, build step, account or service is needed. Nothing is persisted.
Packages are distributed through GitHub Packages; local tarballs also work.

## Plain HTML

Copy `larry.js`, `larry.css` and `assets/` into the same folder on your site:

```html
<link rel="stylesheet" href="/larry/larry.css">
<script type="module">
  import { mountLarry } from '/larry/larry.js';
  const larry = mountLarry();
</script>
```

Run the script after the page body exists. Larry starts in the lower-right corner.
Page links and controls keep their normal actions. Larry and his captions are
decorative and excluded from the accessibility tree. Reduced motion keeps him
still and makes Companion travel immediate.

## GitHub Packages

Add this scope mapping to your site's `.npmrc`:

```ini
@travisfortney:registry=https://npm.pkg.github.com
```

Authenticate with a GitHub personal access token (classic) with `read:packages`,
then install the pinned version:

```sh
npm install @travisfortney/larry@0.3.2
```

Keep tokens in your user configuration or CI secrets. For GitHub Actions, grant
the consuming repository package access and use its `GITHUB_TOKEN` with
`packages: read`. The initial package visibility is private.

## Local npm package

With Node.js 20 or later, run `make pack-web` from the repository root. Install
`dist/travisfortney-larry-0.3.2.tgz` into your app with `npm install /path/to/the.tgz`.

```js
import { mountLarry } from '@travisfortney/larry';
import '@travisfortney/larry/larry.css';

const larry = mountLarry({ assetBase: '/larry/assets/' });
```

Copy the five packaged images into that public asset folder with your app's
existing asset handling. The default asset location is next to the module;
bundled apps should supply `assetBase` explicitly, including its trailing slash.

## Modes

| Mode | Behavior |
| --- | --- |
| `companion` | Default feeding, directional gaze, sleep, occasional hops and existing captions. |
| `cameo` | Hidden until `show()`; a short, silent wave. |
| `greeter` | One silent wave after the artwork loads. |
| `reactions` | Silent wave after a 350ms mouse hover or keyboard focus on `hoverTargets`. |
| `inspector` | Sits quietly inside the supplied `dialog` while it is open. |
| `task-buddy` | Responds to explicit `react()` calls from your app. |
| `lookout` | A persistent, still companion in the corner. |
| `easter-egg` | A wave when the supplied `trigger` element is clicked. |

Only Companion feeds, tracks the pointer or speaks. All other handles expose
`show()`, `hide()` and `react()`. Every mode supports `destroy()`.

```js
const larry = mountLarry({ mode: 'cameo', duration: 6000 });
larry.show();
larry.hide();
```

`duration` is positive milliseconds, defaulting to six seconds. Another `show()`
restarts the visible time. Appearances wait for their image to load. Hiding the
page cancels an appearance without queuing one on return; call `show()` again
when appropriate. Inspector follows changes to its dialog's open state.

Supply existing page elements for automatic presets:

```js
mountLarry({ mode: 'inspector', dialog: document.querySelector('#notes') });
// Or:
mountLarry({ mode: 'reactions', hoverTargets: '.project-link' });
// Or:
mountLarry({ mode: 'easter-egg', trigger: document.querySelector('#signature') });
```

Mount one of these at a time. Inspector requires a `<dialog>` element. Reaction
targets retain their links and actions. Easter Egg adds a click listener without
changing the trigger's existing behavior.

Task Buddy uses existing poses and needs no task API or polling:

```js
const larry = mountLarry({ mode: 'task-buddy' });
larry.react('working');   // Persistent resting pose.
larry.react('waiting');   // Same quiet pose while waiting.
larry.react('success');   // One small hop, then hide after duration.
larry.react('attention'); // Persistent wave.
larry.react('idle');      // Hide.
```

Reduced motion suppresses the hop and uses the original still image for waves.

## Options and cleanup

`anchor` is an optional element to perch beside. Companion also accepts `dialog`
for its existing inspection behavior and `hoverTargets` for occasional captions.
`assetBase` is the folder URL containing the five images.

Only one Larry can be mounted per page. Call `larry.destroy()` when removing a
page or component. It removes the character, listeners, timers and animation
callbacks; calling it again is safe. Hidden pages suspend Companion's movement
and idle timer, and clear any unfinished treat.

The stylesheet uses page colors when present. Override `--larry-paper`,
`--larry-ink`, `--larry-rule` or `--larry-font` to match another site. The desktop
pet and GitHub profile animation keep their separate formats.

## Artwork and size

The original four-pose wave is unchanged, about 124 kB. The three sprite strips
are about 54, 80 and 92 kB; their original sources remain in `qa/sources/web/`.
The still PNG is a lossless copy of the first wave frame, about 50 kB. Static
presets use it alone; wave and task poses load when needed. Failed waves fall
back to that still, and missing optional strips leave basic feeding usable.

Travel uses elapsed time and CSS transforms. Walking artwork changes at most
20 times per second, without interpolation or generated intermediate poses.
Blinks and hops repaint only when their pose changes; hop movement still follows
each display frame. Companion has no continuous JavaScript animation loop while
idle and suspends its idle timer when the page is hidden. For occasional
appearances on another site, use Cameo or Reactions; Lookout uses only the still
image. These modes have no idle interval.
The tarball stays under 500 kB, including all images, module, styles and usage.

## Checks

`make test` validates the existing desktop package. `make test-web` checks the
archive and an offline consumer installation. Rebuild with `make pack-web` after
changing web source. Artwork derivatives can be rebuilt with
`python3 scripts/optimize-web-assets.py` using the existing development dependencies.

`make test-web-browser` uses an existing Playwright installation and installed
Chrome by default. Set `LARRY_BROWSER=firefox` or `LARRY_BROWSER=webkit` to check
those engines with their matching Playwright runtimes. `LARRY_PLAYWRIGHT_MODULE`
can point to an installation outside the usual Node module search path. Optional
`LARRY_ARTIFACT_DIR` saves screenshots. The tests serve the packed files from a
temporary local server and close their own browser. Engine checks cover desktop
and narrow touch layouts; physical devices and older browser versions need
their own testing.

## Publishing

Run the repository's **Publish web package** workflow manually from `main`.
It checks the archive, the 500 kB limit and an offline consumer installation,
then publishes the tested tarball to GitHub Packages and verifies a fresh registry
installation. It uses the workflow token; no stored publishing secret is needed.
Increment `web/package.json` before each release. Published versions cannot be
replaced. Desktop pet files and artwork sources are outside the npm archive.
