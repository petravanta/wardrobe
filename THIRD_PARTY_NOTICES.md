# Third-party notices

Wardrobe's own code and content are under the MIT licence in [LICENSE](LICENSE). It also ships, or downloads at run time, material from the projects below, under their own terms.

## @imgly/background-removal (AGPL-3.0)

[`vendor/background-removal.js`](vendor/background-removal.js) is a bundle of [`@imgly/background-removal`](https://github.com/imgly/background-removal-js) 1.7.0 by IMG.LY, licensed under the [GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0.html). The model files it downloads from IMG.LY's CDN (`@imgly/background-removal-data`) come under the same licence.

Because this library is part of the app, Wardrobe as a whole is shared under AGPL-3.0 terms: anyone who distributes it or runs a modified copy for others must offer that copy's full source under the AGPL. This repository is that source. Wardrobe's own files stay MIT, so a copy without this library (or with a differently licensed replacement) is MIT only. To rebuild the bundle, see the README's *Clean background* section.

## ONNX Runtime Web (MIT)

The same bundle includes [onnxruntime-web](https://github.com/microsoft/onnxruntime) 1.21.0, © Microsoft Corporation, under the MIT licence.
