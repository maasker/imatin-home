# imatin.dev · MH://cortex

Home page of **Matin Hassanloo**.

## What's actually running

- Leaky integrate-and-fire units placed on the glyphs of the name (sampled from rendered text), plus a sparse
  background network. Each unit wires to its 3 nearest neighbours; ~16% are inhibitory (amber).
- Spikes travel along synapses at 260 px/s. **Homeostatic synaptic scaling** tunes `w_exc` so the awake network
  idles near 0.8 Hz, close to criticality, so activity spreads as **neuronal avalanches** (logged live).
- Cursor = stimulating electrode (it also physically nudges the neurons). Click = current pulse.
- **SYS.MON** shows real numbers from the sim; the raster tracks 24 actual units; the bottom strip is the population LFP.
- Idle 25 s → slow-wave sleep (synchronous ~0.8 Hz up-states). Move to wake.

## Easter eggs (spoilers)

| Trigger | Effect |
|---|---|
| first visit | BIOS-style boot sequence (once per session, click/any key to skip) |
| `` ` `` / `~` (or `>_` on phones) | root shell: `help`, Tab completion, ↑/↓ history |
| shell `hack` | port scan, firewall bypass progress bar, ACCESS GRANTED |
| shell `ping lab.imatin.dev` | real HTTP round-trip times → axon distance |
| shell `ssh lab` | jumps into the lab site's own shell |
| shell `cat secrets.txt` / `cortex.c` / `.bash_history` | hints and jokes |
| `L` `C` `G` `M` | open lab / cv / github / mail |
| click the name 5× fast (or shell `morph`) | neurons fly into new forms: متین حسنلو → M4T1N H455ANL00 → 0x4D48 → MH, then rewire |
| type `sniff` / `smell` | odor plume drifts through the cortex |
| type `coffee` | 20 s of caffeine, higher excitability |
| type `sleep` | slow-wave sleep |
| type `hack` | instant ACCESS GRANTED |
| type `matrix` | green theme |
| ↑ ↑ ↓ ↓ ← → ← → B A | breach screen + traveling wave |
| shell `theme mint|amber|violet|matrix|mono` | recolour (remembered) |
| devtools console | ASCII logo + `cortex.help()` API |
| switching tabs | title changes |
| any bad URL | `404.html` |

## Edit before launch

- `public/index.html`: replace `mailto:YOUR_EMAIL@example.com`.
- `cv.imatin.dev` doesn't exist yet. Build it, or point the link at a PDF (`public/cv.pdf` → `href="/cv.pdf"`) for now.
- Taglines: `TAGS` in `public/main.js`. Name forms: `FORMS`. Boot log: `BOOT`. Shell: `run()`.

## Run locally

```bash
npx serve public          # → http://localhost:3000
# or
python3 -m http.server 8080 -d public
# or, to test the 404 page exactly like Cloudflare:
npx wrangler dev          # → http://localhost:8787
```
Note: the boot sequence shows once per browser tab. Open a new tab (or clear sessionStorage) to see it again.

## Deploy (Cloudflare Workers, same account as the lab)

1. Push this folder to a new GitHub repo, e.g. `maasker/imatin-home`.
2. Cloudflare → **Workers & Pages → Create → Import a repository** → pick it. Build command: empty. Deploy command: `npx wrangler deploy`.
3. DNS for imatin.dev → **Add record**: `AAAA @ 100::` (Proxied) and `AAAA www 100::` (Proxied).
4. **imatin-home → Domains → Add Route**: `imatin.dev/*`, then again `www.imatin.dev/*`.
