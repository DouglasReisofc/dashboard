"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "react-bootstrap";

import type { BotMenuConfig } from "types/bot";
import type { MetaBusinessProfile } from "types/meta";

import UserBotMenuEditor from "./UserBotMenuEditor";
import UserBotProfileForm from "./UserBotProfileForm";

interface UserBotConfigPanelProps {
  menuConfig: BotMenuConfig | null;
  profile: MetaBusinessProfile | null;
  hasWebhookCredentials: boolean;
}

type ViewId = "messages" | "profile";

type ViewOption = {
  id: ViewId;
  label: string;
  description: string;
};

const VIEW_OPTIONS: readonly ViewOption[] = [
  {
    id: "messages",
    label: "Conteúdo do bot",
    description:
      "Edite as mensagens automáticas, variáveis e mídias enviadas pelo bot durante a navegação.",
  },
  {
    id: "profile",
    label: "Perfil do WhatsApp",
    description:
      "Atualize foto, descrição e dados comerciais exibidos no perfil do número integrado à Meta.",
  },
];

const UserBotConfigPanel = ({
  menuConfig,
  profile,
  hasWebhookCredentials,
}: UserBotConfigPanelProps) => {
  const [activeView, setActiveView] = useState<ViewId>("messages");

  const activeOption = useMemo(
    () => VIEW_OPTIONS.find((option) => option.id === activeView) ?? VIEW_OPTIONS[0],
    [activeView],
  );

  return (
    <div className="d-flex flex-column gap-4">
      <Card>
        <Card.Body>
          <Card.Title as="h2" className="h5">
            Selecione o que deseja configurar
          </Card.Title>
          <Card.Text className="text-secondary mb-3">
            Escolha abaixo entre editar o conteúdo automatizado do bot ou gerenciar o perfil comercial do WhatsApp.
          </Card.Text>

          <div className="d-flex flex-wrap gap-2">
            {VIEW_OPTIONS.map((option) => (
              <Button
                key={option.id}
                variant={activeView === option.id ? "primary" : "outline-primary"}
                onClick={() => setActiveView(option.id)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          <Card.Text className="text-secondary mb-0 mt-3">{activeOption.description}</Card.Text>
        </Card.Body>
      </Card>

      {activeView === "messages" && <UserBotMenuEditor config={menuConfig} />}
      {activeView === "profile" && (
        <UserBotProfileForm profile={profile} hasWebhookCredentials={hasWebhookCredentials} />
      )}
    </div>
  );
};

export default UserBotConfigPanel;
