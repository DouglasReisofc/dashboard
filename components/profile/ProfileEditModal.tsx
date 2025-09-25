"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Dropdown,
  DropdownButton,
  Form,
  InputGroup,
  Modal,
  Spinner,
} from "react-bootstrap";
import { useRouter } from "next/navigation";

import type { SessionUser } from "types/auth";
import { PHONE_COUNTRIES, findCountryByDialCode } from "data/phone-countries";

interface ProfileEditModalProps {
  show: boolean;
  onHide: () => void;
  user: SessionUser;
}

type Feedback = { type: "success" | "danger"; message: string } | null;

type FormState = {
  name: string;
  email: string;
  password: string;
  whatsappDialCode: string;
  whatsappNumber: string;
};

const initialState: FormState = {
  name: "",
  email: "",
  password: "",
  whatsappDialCode: PHONE_COUNTRIES[0].dialCode,
  whatsappNumber: "",
};

const parseWhatsapp = (value: string | null): { dialCode: string; number: string } => {
  if (!value) {
    return {
      dialCode: PHONE_COUNTRIES[0].dialCode,
      number: "",
    };
  }

  const trimmed = value.trim();
  const matchedCountry = [...PHONE_COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((country) => trimmed.startsWith(country.dialCode));

  if (matchedCountry) {
    const rest = trimmed.slice(matchedCountry.dialCode.length).replace(/[^0-9]/g, "");
    return {
      dialCode: matchedCountry.dialCode,
      number: rest,
    };
  }

  const digits = trimmed.replace(/[^0-9]/g, "");
  return {
    dialCode: PHONE_COUNTRIES[0].dialCode,
    number: digits,
  };
};

const ProfileEditModal = ({ show, onHide, user }: ProfileEditModalProps) => {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(initialState);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!show) {
      return;
    }

    const parsedWhatsapp = parseWhatsapp(user.whatsappNumber ?? null);
    setFormState({
      name: user.name,
      email: user.email,
      password: "",
      whatsappDialCode: parsedWhatsapp.dialCode,
      whatsappNumber: parsedWhatsapp.number,
    });
    setFeedback(null);
    setAvatarFile(null);
    setRemoveAvatar(false);
    setAvatarPreview(user.avatarUrl ?? "/images/avatar/avatar-fallback.jpg");
  }, [show, user]);

  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  const selectedCountry = useMemo(() => {
    return findCountryByDialCode(formState.whatsappDialCode) ?? PHONE_COUNTRIES[0];
  }, [formState.whatsappDialCode]);

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }
    onHide();
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setFeedback({ type: "danger", message: "Selecione um arquivo de imagem válido." });
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: "danger", message: "O avatar deve ter no máximo 5 MB." });
      return;
    }

    if (avatarPreview && avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
    event.target.value = "";
  };

  const handleRemoveAvatar = () => {
    if (avatarPreview && avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(null);
    setAvatarPreview("/images/avatar/avatar-fallback.jpg");
    setRemoveAvatar(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!formState.name.trim()) {
      setFeedback({ type: "danger", message: "Informe seu nome." });
      return;
    }

    if (!formState.email.trim()) {
      setFeedback({ type: "danger", message: "Informe seu e-mail." });
      return;
    }

    const digits = formState.whatsappNumber.replace(/[^0-9]/g, "");
    if (digits.length < 8 || digits.length > 15) {
      setFeedback({ type: "danger", message: "Informe um número de WhatsApp válido (DDD + número)." });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("name", formState.name.trim());
      formData.append("email", formState.email.trim());
      formData.append("whatsappDialCode", formState.whatsappDialCode);
      formData.append("whatsappNumber", digits);

      if (formState.password.trim()) {
        formData.append("password", formState.password.trim());
      }

      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      if (removeAvatar && !avatarFile) {
        formData.append("removeAvatar", "true");
      }

      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFeedback({
          type: "danger",
          message: data.message ?? "Não foi possível atualizar o perfil.",
        });
        setIsSubmitting(false);
        return;
      }

      setFeedback({ type: "success", message: data.message ?? "Perfil atualizado com sucesso." });
      if (data.user && typeof data.user === "object") {
        const nextAvatar = typeof data.user.avatarUrl === "string"
          ? data.user.avatarUrl
          : "/images/avatar/avatar-fallback.jpg";
        if (avatarPreview && avatarPreview.startsWith("blob:")) {
          URL.revokeObjectURL(avatarPreview);
        }
        setAvatarPreview(nextAvatar);
        setAvatarFile(null);
        setRemoveAvatar(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
      router.refresh();
      setTimeout(() => {
        setIsSubmitting(false);
        onHide();
      }, 600);
    } catch (error) {
      console.error("Failed to update profile", error);
      setFeedback({
        type: "danger",
        message: "Não foi possível se comunicar com o servidor.",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton={!isSubmitting}>
        <Modal.Title>Editar perfil</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          {feedback && (
            <Alert
              variant={feedback.type}
              onClose={() => setFeedback(null)}
              dismissible
            >
              {feedback.message}
            </Alert>
          )}
          <div className="d-flex justify-content-center mb-4">
            <div className="d-flex flex-column align-items-center gap-3">
              <img
                src={avatarPreview ?? "/images/avatar/avatar-fallback.jpg"}
                alt={formState.name || user.name}
                className="rounded-circle border"
                style={{ width: "96px", height: "96px", objectFit: "cover" }}
              />
              <div className="d-flex gap-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  Alterar avatar
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleRemoveAvatar}
                  disabled={isSubmitting}
                >
                  Remover
                </Button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="d-none"
              onChange={handleAvatarChange}
            />
          </div>
          <Form.Group className="mb-3" controlId="profileName">
            <Form.Label>Nome</Form.Label>
            <Form.Control
              type="text"
              value={formState.name}
              onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Seu nome completo"
              required
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="profileEmail">
            <Form.Label>E-mail</Form.Label>
            <Form.Control
              type="email"
              value={formState.email}
              onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="nome@empresa.com"
              required
            />
          </Form.Group>
          <Form.Group className="mb-3" controlId="profileWhatsapp">
            <Form.Label>WhatsApp</Form.Label>
            <InputGroup>
              <DropdownButton
                variant="outline-secondary"
                id="profileWhatsappDialCode"
                title={(
                  <span className="d-inline-flex align-items-center gap-2">
                    <img
                      src={`/flags/${selectedCountry.code.toLowerCase()}.svg`}
                      alt={`Bandeira ${selectedCountry.label}`}
                      width={24}
                      height={16}
                      className="rounded border"
                    />
                    <span>{selectedCountry.dialCode}</span>
                  </span>
                )}
                onSelect={(eventKey) => {
                  if (!eventKey) {
                    return;
                  }
                  setFormState((prev) => ({
                    ...prev,
                    whatsappDialCode: eventKey,
                  }));
                }}
              >
                {PHONE_COUNTRIES.map((country) => (
                  <Dropdown.Item eventKey={country.dialCode} key={country.code}>
                    <span className="d-inline-flex align-items-center gap-2">
                      <img
                        src={`/flags/${country.code.toLowerCase()}.svg`}
                        alt={`Bandeira ${country.label}`}
                        width={24}
                        height={16}
                        className="rounded border"
                      />
                      <span>{country.label} ({country.dialCode})</span>
                    </span>
                  </Dropdown.Item>
                ))}
              </DropdownButton>
              <Form.Control
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{8,15}"
                placeholder="DDD + número"
                value={formState.whatsappNumber}
                onChange={(event) => {
                  const digits = event.target.value.replace(/[^0-9]/g, "");
                  setFormState((prev) => ({
                    ...prev,
                    whatsappNumber: digits,
                  }));
                }}
                required
              />
            </InputGroup>
            <Form.Text className="text-secondary">
              Digite apenas números. Ex.: 11999887766.
            </Form.Text>
          </Form.Group>
          <Form.Group controlId="profilePassword" className="mb-0">
            <Form.Label>Senha</Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              value={formState.password}
              onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Deixe em branco para manter a atual"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="d-inline-flex align-items-center gap-2">
                <Spinner animation="border" size="sm" />
                Salvando...
              </span>
            ) : (
              "Salvar alterações"
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default ProfileEditModal;
