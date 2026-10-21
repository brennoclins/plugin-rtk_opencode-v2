// SPDX-License-Identifier: GPL-3.0-or-later

import { Plugin } from "@opencode/plugin"
import { setup } from "./plugin.js"

export const PLUGIN_ID = "plugin-rtk_opencode-v2"

export default Plugin.define({
  id: PLUGIN_ID,
  setup,
})
