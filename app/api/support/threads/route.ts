import { NextResponse } from "next/server";

import { getCurrentUser } from "lib/auth";
import { listSupportThreads, buildSupportThreadSummary } from "lib/support";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
    }

    const threads = await listSupportThreads(user.id);
    const summaries = await Promise.all(
      threads.map((thread) => buildSupportThreadSummary(user.id, thread)),
    );

    return NextResponse.json({ threads: summaries });
  } catch (error) {
    console.error("Failed to list support threads", error);
    return NextResponse.json({ message: "Erro ao listar conversas." }, { status: 500 });
  }
}
