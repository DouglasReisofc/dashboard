import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser, revokeSessionsForUser } from "lib/auth";
import { getAdminUserById, setUserActiveState } from "lib/users";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        { message: "Acesso não autorizado." },
        { status: 403 },
      );
    }

    const userId = Number.parseInt(params.id, 10);

    if (Number.isNaN(userId)) {
      return NextResponse.json(
        { message: "Identificador de usuário inválido." },
        { status: 400 },
      );
    }

    const payload = await request.json().catch(() => ({}));
    const { isActive, revokeSessions } = payload as {
      isActive?: unknown;
      revokeSessions?: unknown;
    };

    if (typeof isActive !== "boolean" && revokeSessions !== true) {
      return NextResponse.json(
        {
          message:
            "Informe se deseja alterar o status do usuário ou encerrar suas sessões.",
        },
        { status: 400 },
      );
    }

    if (typeof isActive === "boolean") {
      await setUserActiveState(userId, isActive);
      if (!isActive) {
        await revokeSessionsForUser(userId);
      }
    }

    if (revokeSessions === true) {
      await revokeSessionsForUser(userId);
    }

    const updatedUser = await getAdminUserById(userId);

    if (!updatedUser) {
      return NextResponse.json(
        { message: "Usuário não encontrado." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      message: "Dados do usuário atualizados com sucesso.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Failed to update user", error);
    return NextResponse.json(
      { message: "Não foi possível atualizar o usuário." },
      { status: 500 },
    );
  }
}
