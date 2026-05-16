import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser } from "@/lib/apiAuth";
import { formatReferencesForClient } from "@/lib/referenceUtils";

async function parsePathIds(params) {
  const resolved = await Promise.resolve(params);
  const summaryId = parseInt(resolved?.id ?? "", 10);
  const refId = parseInt(resolved?.refId ?? "", 10);
  return {
    summaryId: Number.isFinite(summaryId) && summaryId > 0 ? summaryId : null,
    refId: Number.isFinite(refId) && refId > 0 ? refId : null,
  };
}

async function assertSummaryOwned(summaryId, userId) {
  const summary = await prisma.summary.findFirst({
    where: { id: summaryId, userId },
    select: { id: true },
  });
  return Boolean(summary);
}

export async function PATCH(req, context) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { summaryId, refId } = await parsePathIds(context.params);
    if (summaryId == null || refId == null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    if (!(await assertSummaryOwned(summaryId, user.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const existing = await prisma.summaryReference.findFirst({
      where: { id: refId, summaryId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Reference not found" },
        { status: 404 },
      );
    }

    const data = {};

    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (t) data.title = t.slice(0, 512);
    }
    if (typeof body.authors === "string" || body.authors === null) {
      const a = body.authors === null ? null : String(body.authors).trim();
      data.authors = a ? a.slice(0, 512) : null;
    }
    if (
      body.year === null ||
      body.year === "" ||
      typeof body.year === "number" ||
      typeof body.year === "string"
    ) {
      let y = body.year;
      if (typeof y === "string") {
        const trimmed = y.trim();
        y = trimmed === "" ? null : parseInt(trimmed, 10);
      }
      data.year =
        y == null || !Number.isFinite(y)
          ? null
          : Math.max(1000, Math.min(9999, Math.round(y)));
    }
    if (typeof body.venue === "string" || body.venue === null) {
      const v = body.venue === null ? null : String(body.venue).trim();
      data.venue = v ? v.slice(0, 256) : null;
    }
    if (typeof body.doi === "string" || body.doi === null) {
      const d = body.doi === null ? null : String(body.doi).trim();
      data.doi = d ? d.slice(0, 128) : null;
    }
    if (typeof body.url === "string" || body.url === null) {
      const u = body.url === null ? null : String(body.url).trim();
      data.url = u ? u.slice(0, 2048) : null;
    }
    if (typeof body.abstract === "string" || body.abstract === null) {
      data.abstract =
        body.abstract === null ? null : String(body.abstract).trim() || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    await prisma.summaryReference.update({
      where: { id: refId },
      data,
    });

    const references = await prisma.summaryReference.findMany({
      where: { summaryId },
      orderBy: { marker: "asc" },
    });

    return NextResponse.json({
      references: formatReferencesForClient(references),
    });
  } catch (err) {
    console.error("Reference PATCH error:", err);
    return NextResponse.json(
      { error: "Failed to update reference" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req, context) {
  try {
    const user = await getRequestUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { summaryId, refId } = await parsePathIds(context.params);
    if (summaryId == null || refId == null) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    if (!(await assertSummaryOwned(summaryId, user.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const deleted = await prisma.summaryReference.deleteMany({
      where: { id: refId, summaryId },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: "Reference not found" },
        { status: 404 },
      );
    }

    const references = await prisma.summaryReference.findMany({
      where: { summaryId },
      orderBy: { marker: "asc" },
    });

    return NextResponse.json({
      references: formatReferencesForClient(references),
    });
  } catch (err) {
    console.error("Reference DELETE error:", err);
    return NextResponse.json(
      { error: "Failed to delete reference" },
      { status: 500 },
    );
  }
}
