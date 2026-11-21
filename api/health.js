import { runApi } from '../server/vercelApi.js';

export default (req, res) => runApi(req, res, async () => ({ body: { ok: true } }));
