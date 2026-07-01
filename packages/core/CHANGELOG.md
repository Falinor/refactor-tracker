# Changelog

## [0.7.0](https://github.com/Falinor/refactor-tracker/compare/refactor-tracker-v0.6.0...refactor-tracker-v0.7.0) (2026-07-01)


### Features

* **cache:** version on-disk cache/state stores + harden --fail-on-regression ([ab50e3b](https://github.com/Falinor/refactor-tracker/commit/ab50e3bf293865bddae7b2a64d8d9b52a994cf1e))
* **cache:** version the on-disk cache and state stores ([7e0f677](https://github.com/Falinor/refactor-tracker/commit/7e0f677cc425fee8ab5aaea036ad38f407634ce1))
* **cli:** add init config template renderer ([f7a1351](https://github.com/Falinor/refactor-tracker/commit/f7a135175c52aaede20ebc84e44558cfa12970b2))
* **cli:** add init option-gathering and file writing ([4e2fd02](https://github.com/Falinor/refactor-tracker/commit/4e2fd025720b54be4bc6f235703332df76be7096))
* **cli:** add interactive `init` command to scaffold a config ([14f022e](https://github.com/Falinor/refactor-tracker/commit/14f022e3bc5de99ae51aa283ff44a2b2e0f17c42))
* **cli:** add interactive init command to scaffold config ([b84f74a](https://github.com/Falinor/refactor-tracker/commit/b84f74ab5fcd64c96ed793062c416622b67adffc))
* **cli:** migrate command wiring from citty to commander ([ff08a45](https://github.com/Falinor/refactor-tracker/commit/ff08a4527f6da78170de0bd120154a45f63c740e))
* **cli:** replace citty with commander ([f4e821b](https://github.com/Falinor/refactor-tracker/commit/f4e821b82ab89608d4e40a067e871fcd2f38b72b))
* **config:** publish JSON Schema for config files ([b16d02a](https://github.com/Falinor/refactor-tracker/commit/b16d02a3fbca0ac1c49da82afedf64f05a935619))
* **config:** publish JSON Schema for config files ([804562c](https://github.com/Falinor/refactor-tracker/commit/804562cb9c5191bc56335c76ea0491ef7a711150))


### Bug Fixes

* **cache:** harden versioned store reads against corrupt files ([62ef24d](https://github.com/Falinor/refactor-tracker/commit/62ef24d9153f73a3c19e329de9938a8ece9f3c0a))
* **cli:** correct init template comment and harden init error paths ([9145293](https://github.com/Falinor/refactor-tracker/commit/9145293eddf73daf1860dea388b62171133ff018))
* **cli:** restore --version/-v on the init and run subcommands ([2514ea6](https://github.com/Falinor/refactor-tracker/commit/2514ea6af18aabd4cd092c4ed03585be8aef51e0))
* **config:** keep generated schema.json out of oxfmt ([711bc39](https://github.com/Falinor/refactor-tracker/commit/711bc3988d4e13921358111c8b543cc442bd4503))

## [0.6.0](https://github.com/Falinor/refactor-tracker/compare/refactor-tracker-v0.5.1...refactor-tracker-v0.6.0) (2026-06-10)


### Features

* **cli:** add --version flag ([d28f597](https://github.com/Falinor/refactor-tracker/commit/d28f597d42b7d3a1334fe376b5c507206d4b33f7))
* **cli:** add --version flag ([f0360ce](https://github.com/Falinor/refactor-tracker/commit/f0360ce70aa0deec593b3cac95f45fa9bd16d812))


### Bug Fixes

* **html-reporter:** render remaining items in tag-grouped layout ([19e8ac6](https://github.com/Falinor/refactor-tracker/commit/19e8ac67687f8521732d9ad8951483e367e7989c))
* **html-reporter:** render remaining items in tag-grouped layout ([eb5993f](https://github.com/Falinor/refactor-tracker/commit/eb5993f32c0341a770b2531017952934f0917e05))

## [0.5.1](https://github.com/Falinor/refactor-tracker/compare/refactor-tracker-v0.5.0...refactor-tracker-v0.5.1) (2026-06-10)


### Bug Fixes

* **cli:** make global CLI entry symlink-safe ([ef474cd](https://github.com/Falinor/refactor-tracker/commit/ef474cd21be43d463625d0efb72229ff73b79f20))

## [0.5.0](https://github.com/Falinor/refactor-tracker/compare/refactor-tracker-v0.4.0...refactor-tracker-v0.5.0) (2026-06-08)


### Features

* **cli:** add --reporter, --id, --no-cache and --cache-path flags ([e0ebcd9](https://github.com/Falinor/refactor-tracker/commit/e0ebcd96ebb740cf96be0b61d6e9347cc279cc8c))


### Bug Fixes

* **engine:** preserve registeredAt under --no-cache when cache exists ([62d4da0](https://github.com/Falinor/refactor-tracker/commit/62d4da0c3c37bbcb319642a16b0c5f0163d28cbe))
* **engine:** preserve registeredAt under --no-cache when cache exists ([28a3878](https://github.com/Falinor/refactor-tracker/commit/28a3878d40ca7f2a7496ac743c81f150cc590807))

## [0.4.0](https://github.com/Falinor/refactor-tracker/compare/refactor-tracker-v0.3.0...refactor-tracker-v0.4.0) (2026-06-08)


### Features

* **cli:** add --report-output to write the typed Report to a file ([ce5859f](https://github.com/Falinor/refactor-tracker/commit/ce5859f74885b5793a7ef40276756ed9cadf34a5))
* **cli:** add --report-output to write the typed Report to a file ([4cf21ce](https://github.com/Falinor/refactor-tracker/commit/4cf21ce2123f8164bfe3e88c15836dd069ae9049))
* rename default config to .refactor-tracker.yml ([d6efe92](https://github.com/Falinor/refactor-tracker/commit/d6efe927444ba92ff27f44161be8e4b3c0c751b6))

## [0.3.0](https://github.com/Falinor/refactor-tracker/compare/refactor-tracker-v0.2.0...refactor-tracker-v0.3.0) (2026-06-04)


### Features

* **reporters:** support module specifiers and factory exports in custom reporter ([5ad8a6b](https://github.com/Falinor/refactor-tracker/commit/5ad8a6bf354a169d69f6a508f70c2277832545b4))
* workspace, custom-loader extension, and Notion reporter ([182a628](https://github.com/Falinor/refactor-tracker/commit/182a628a306089d776a3a00935f07985b2650513))

## [0.2.0](https://github.com/Falinor/refactor-tracker/compare/v0.1.0...v0.2.0) (2026-06-01)

### Bug Fixes

- **html-reporter:** address final review feedback ([5718260](https://github.com/Falinor/refactor-tracker/commit/5718260e8a4c050889a733cf4cbbfa43bca7f872))

### Features

- add optional description per refactor ([5b5e00a](https://github.com/Falinor/refactor-tracker/commit/5b5e00a26bc78cf6562377eeb9aff694544a15ab))
- **html-reporter:** add delta chip with up/down/none states ([f8e49c2](https://github.com/Falinor/refactor-tracker/commit/f8e49c2c6d123b8103e4c34dbf29e266f28318ef))
- **html-reporter:** add eta template engine dependency ([272c488](https://github.com/Falinor/refactor-tracker/commit/272c48824bc0db12c4e02447f5788421ab68dab9))
- **html-reporter:** add overall summary section with aggregate bar ([2e84651](https://github.com/Falinor/refactor-tracker/commit/2e84651ceacfa683e40a586121f5a84a64ac6345))
- **html-reporter:** color bars by completion percentage ([2a5b019](https://github.com/Falinor/refactor-tracker/commit/2a5b019b181a2b9d21a8a848d93e2c734921055c))
- **html-reporter:** elevate summary card and locale-format timestamp ([db40c03](https://github.com/Falinor/refactor-tracker/commit/db40c03f9b787f780ca2c715a11894f111d29f73))
- **html-reporter:** register html in the reporter factory ([1e31f92](https://github.com/Falinor/refactor-tracker/commit/1e31f92eaf93ec7089af2f037743ec09259b38f5))
- **html-reporter:** render per-refactor cards with progress bars ([e3f873b](https://github.com/Falinor/refactor-tracker/commit/e3f873b864b214d85b603eb45e0743c7986ee4bc))
- **html-reporter:** scaffold formatHtml and HtmlReporter shell ([0a3e768](https://github.com/Falinor/refactor-tracker/commit/0a3e7686da84645afce77dbffb8c01d498038038))
- **html-reporter:** widen the gap below the overall summary ([9499c5f](https://github.com/Falinor/refactor-tracker/commit/9499c5ff92e8cfc53441f947143ad3cf2e5603a2))
- **html-reporter:** write rendered html to output path ([71a9b6c](https://github.com/Falinor/refactor-tracker/commit/71a9b6cb5576574f3e55f2fe52e794d093422d18))
