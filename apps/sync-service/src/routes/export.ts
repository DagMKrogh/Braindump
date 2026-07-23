import type { FastifyPluginAsync } from 'fastify'

// POST /notes/:id/export/pdf       → generate and return PDF via Puppeteer
// POST /notes/:id/export/markdown  → return markdown download
// GET  /s/:token                   → public shared note viewer (no auth)
// GET  /s/:token/pdf               → public PDF download of shared note

export const exportRoutes: FastifyPluginAsync = async (_app) => {
  // TODO: implement PDF export (Puppeteer) and public share viewer
}
