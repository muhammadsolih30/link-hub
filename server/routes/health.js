import { runApi } from '../vercelApi.js';

export default (req, res) => runApi(req, res, async () => ({ body: { ok: true } }));
