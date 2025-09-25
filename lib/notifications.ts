import type { PaymentCharge } from "types/payments";
import type { UserNotification } from "types/notifications";

import { sendEmail, EmailNotConfiguredError, EmailDeliveryError } from "./email";
import { getAdminEmailTemplate } from "./admin-email-templates";
import { renderEmailTemplate } from "./email-template";
import { createUserNotification } from "./user-notifications";
import { emitUserNotificationCreated } from "./realtime";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatCurrency = (amount: number) => currencyFormatter.format(amount);

const getAppBaseUrl = () => {
  const raw = process.env.APP_URL?.trim();
  if (!raw) {
    return "https://storebot.app";
  }

  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
};

const replacePlaceholders = (template: string, context: Record<string, string>): string =>
  template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (match, key) => {
    const value = context[key];
    return typeof value === "string" ? value : match;
  });

const buildEmailFromTemplate = async (
  key: string,
  fallback: {
    subject: string;
    heading: string;
    bodyHtml: string;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
    footerText?: string | null;
  },
  context: Record<string, string>,
) => {
  const storedTemplate = await getAdminEmailTemplate(key);
  const template = storedTemplate ?? {
    key,
    name: key,
    subject: fallback.subject,
    heading: fallback.heading,
    bodyHtml: fallback.bodyHtml,
    ctaLabel: fallback.ctaLabel ?? null,
    ctaUrl: fallback.ctaUrl ?? null,
    footerText: fallback.footerText ?? null,
    updatedAt: new Date().toISOString(),
  };

  const subject = replacePlaceholders(template.subject, context);
  const heading = replacePlaceholders(template.heading, context);
  const bodyHtml = replacePlaceholders(template.bodyHtml, context);
  const ctaLabel = template.ctaLabel ? replacePlaceholders(template.ctaLabel, context) : null;
  const ctaUrl = template.ctaUrl ? replacePlaceholders(template.ctaUrl, context) : null;
  const footerText = template.footerText ? replacePlaceholders(template.footerText, context) : null;

  const html = renderEmailTemplate({
    heading,
    bodyHtml,
    ctaLabel,
    ctaUrl,
    footerText,
  });

  return {
    subject,
    html,
  };
};

const emitRealtimeNotification = (notification: UserNotification) => {
  emitUserNotificationCreated({
    userId: notification.userId,
    notification: {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      metadata: notification.metadata ?? null,
    },
  });
};

export const buildGenericNotificationEmail = async ({
  subject,
  message,
  userName,
}: {
  subject: string;
  message: string;
  userName: string;
}) =>
  buildEmailFromTemplate(
    "generic_notification",
    {
      subject: "{{subject}}",
      heading: "Olá!",
      bodyHtml: "<p>Olá, <strong>{{userName}}</strong>!</p><p>{{message}}</p>",
      footerText: "Equipe StoreBot",
    },
    {
      subject,
      message,
      userName,
    },
  );

export const sendWelcomeEmail = async (payload: {
  userId: number;
  userName: string;
  userEmail: string;
}) => {
  if (!payload.userEmail) {
    return;
  }

  const subject = "Bem-vindo ao StoreBot";
  const plainMessage = `Olá, ${payload.userName || "bem-vindo"}!\n\nSua conta no StoreBot foi criada com sucesso. Acesse o painel para configurar categorias, produtos e habilitar os pagamentos.`;

  try {
    const { subject: finalSubject, html } = await buildEmailFromTemplate(
      "welcome_user",
      {
        subject: "{{subject}}",
        heading: "Bem-vindo ao StoreBot!",
        bodyHtml:
          `<p>Olá, <strong>{{userName}}</strong>! 👋</p>
           <p>Sua conta foi criada com sucesso. Acesse o painel para configurar categorias, produtos e habilitar os pagamentos.</p>
           <p>Se precisar de ajuda, conte com a nossa equipe.</p>`,
        ctaLabel: "Ir para o painel",
        ctaUrl: "{{dashboardUrl}}",
        footerText: "Equipe StoreBot",
      },
      {
        subject,
        userName: payload.userName,
        dashboardUrl: `${getAppBaseUrl()}/dashboard/user`,
      },
    );

    await sendEmail({
      to: payload.userEmail,
      subject: finalSubject,
      text: plainMessage,
      html,
    });

    await createUserNotification({
      userId: payload.userId,
      type: "welcome",
      title: subject,
      message: plainMessage,
    });
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      console.warn("[notifications] SMTP não configurado. E-mail de boas-vindas não enviado.");
      return;
    }

    if (error instanceof EmailDeliveryError) {
      console.error("[notifications] Falha ao enviar e-mail de boas-vindas", error);
      return;
    }

    console.error("[notifications] Erro inesperado ao enviar e-mail de boas-vindas", error);
  }
};

export const sendBalanceTopUpNotification = async (payload: {
  userId: number;
  userName: string;
  userEmail: string;
  amount: number;
  newBalance: number;
}) => {
  if (!payload.userEmail) {
    return;
  }

  const subject = `Saldo adicionado - ${formatCurrency(payload.amount)}`;
  const message = `Recebemos a confirmação da adição de saldo no valor de ${formatCurrency(payload.amount)}. Seu novo saldo é ${formatCurrency(payload.newBalance)}.`;

  try {
    const { subject: finalSubject, html } = await buildGenericNotificationEmail({
      subject,
      message,
      userName: payload.userName,
    });

    await sendEmail({
      to: payload.userEmail,
      subject: finalSubject,
      text: message,
      html,
    });

    const notification = await createUserNotification({
      userId: payload.userId,
      type: "balance_topup",
      title: subject,
      message,
      metadata: {
        amount: payload.amount,
        balance: payload.newBalance,
      },
    });

    emitRealtimeNotification(notification);
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      console.warn("[notifications] SMTP não configurado. Notificação de saldo não enviada.");
      return;
    }

    if (error instanceof EmailDeliveryError) {
      console.error("[notifications] Falha ao enviar notificação de saldo", error);
      return;
    }

    console.error("[notifications] Erro inesperado ao enviar e-mail de saldo", error);
  }
};

export const sendCustomerBalanceCreditNotification = async (payload: {
  userId: number;
  userName: string;
  userEmail: string | null;
  amount: number;
  customerName: string | null;
  customerWhatsapp: string | null;
  newCustomerBalance: number;
}) => {
  const customerLabel = payload.customerName?.trim()
    || payload.customerWhatsapp?.trim()
    || "Cliente do bot";

  const subject = `Cliente adicionou saldo - ${formatCurrency(payload.amount)}`;
  const messageLines = [
    `O cliente ${customerLabel} adicionou saldo de ${formatCurrency(payload.amount)}.`,
    `Saldo atual do cliente: ${formatCurrency(payload.newCustomerBalance)}.`,
  ];

  try {
    if (payload.userEmail) {
      const { subject: finalSubject, html } = await buildEmailFromTemplate(
        "customer_balance_credit",
        {
          subject: `{{subject}}`,
          heading: "Novo crédito realizado",
          bodyHtml:
            `<p>Olá, <strong>{{userName}}</strong>! Um cliente acabou de adicionar saldo.</p>
             <p><strong>{{customer}}</strong> creditou <strong>{{amount}}</strong> na carteira.</p>
             <p>Saldo atual do cliente: <strong>{{customerBalance}}</strong>.</p>`,
          ctaLabel: "Gerenciar clientes",
          ctaUrl: "{{customersUrl}}",
          footerText: "Notificação automática do StoreBot",
        },
        {
          subject,
          userName: payload.userName,
          customer: customerLabel,
          amount: formatCurrency(payload.amount),
          customerBalance: formatCurrency(payload.newCustomerBalance),
          customersUrl: `${getAppBaseUrl()}/dashboard/user/clientes`,
        },
      );

      await sendEmail({
        to: payload.userEmail,
        subject: finalSubject,
        text: messageLines.join("\n"),
        html,
      });
    }

    const notification = await createUserNotification({
      userId: payload.userId,
      type: "customer_balance_credit",
      title: subject,
      message: messageLines.join(" "),
      metadata: {
        amount: payload.amount,
        customerName: payload.customerName,
        customerWhatsapp: payload.customerWhatsapp,
        customerBalance: payload.newCustomerBalance,
      },
    });

    emitRealtimeNotification(notification);
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      console.warn("[notifications] SMTP não configurado. Notificação de crédito ignorada.");
      return;
    }

    if (error instanceof EmailDeliveryError) {
      console.error("[notifications] Falha ao enviar notificação de crédito", error);
      return;
    }

    console.error("[notifications] Erro inesperado ao notificar crédito", error);
  }
};

export const sendUserSaleNotification = async (payload: {
  userName: string;
  userEmail: string;
  charge: PaymentCharge;
}) => {
  if (!payload.userEmail) {
    return;
  }

  const amountLabel = formatCurrency(payload.charge.amount);
  const methodLabel = payload.charge.provider === "mercadopago_checkout"
    ? "Mercado Pago Checkout"
    : payload.charge.provider === "mercadopago_pix"
      ? "Mercado Pago Pix"
      : payload.charge.provider;

  const customerInfo = payload.charge.customerName || payload.charge.customerWhatsapp;
  const appUrl = `${getAppBaseUrl()}/dashboard/user/pagamentos`;
  try {
    const context = {
      userName: payload.userName || "",
      amount: amountLabel,
      paymentMethod: methodLabel,
      customer: customerInfo ?? "Cliente não identificado",
      salesUrl: appUrl,
    } satisfies Record<string, string>;

    const { subject, html } = await buildEmailFromTemplate(
      "bot_sale_notification",
      {
        subject: `Nova venda recebida - ${amountLabel}`,
        heading: "Venda aprovada!",
        bodyHtml:
          `<p>Olá, <strong>{{userName}}</strong>! Uma nova venda foi confirmada no seu bot pelo valor de <strong>{{amount}}</strong>.</p><p>Forma de pagamento: <strong>{{paymentMethod}}</strong>.</p><p>Cliente: {{customer}}</p>`,
        ctaLabel: "Ver detalhes",
        ctaUrl: "{{salesUrl}}",
        footerText: "Continue oferecendo a melhor experiência para os seus clientes.",
      },
      context,
    );

    const textLines = [
      `Olá, ${context.userName || "vendedor"}!`,
      `Uma nova venda foi confirmada no seu bot pelo valor de ${context.amount}.`,
      `Forma de pagamento: ${context.paymentMethod}.`,
      `Cliente: ${context.customer}.`,
      `Veja detalhes: ${context.salesUrl}`,
    ];

    await sendEmail({
      to: payload.userEmail,
      subject,
      text: textLines.join("\n"),
      html,
    });

    const notification = await createUserNotification({
      userId: payload.charge.userId,
      type: "bot_sale",
      title: subject,
      message: `${context.amount} - ${context.paymentMethod}`,
      metadata: {
        paymentId: payload.charge.providerPaymentId,
        amount: payload.charge.amount,
        paymentMethod: context.paymentMethod,
        customer: context.customer,
      },
    });

    emitRealtimeNotification(notification);
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      console.warn("[notifications] SMTP não configurado. Notificação não enviada.");
      return;
    }

    if (error instanceof EmailDeliveryError) {
      console.error("[notifications] Falha ao enviar notificação de venda", error);
      return;
    }

    console.error("[notifications] Erro inesperado ao enviar e-mail", error);
  }
};

export const sendBotProductPurchaseNotification = async (payload: {
  userId: number;
  userName: string;
  userEmail: string | null;
  categoryName: string;
  amount: number;
  customerName?: string | null;
  customerWhatsapp?: string | null;
  customerBalanceAfter?: number | null;
  productDetails?: string | null;
}) => {
  const amountLabel = formatCurrency(payload.amount);
  const customerLabel = payload.customerName?.trim()
    || payload.customerWhatsapp?.trim()
    || "Cliente do bot";
  const subject = `Nova compra no bot - ${payload.categoryName}`;

  try {
    if (payload.userEmail) {
      const { subject: finalSubject, html } = await buildEmailFromTemplate(
        "bot_product_purchase",
        {
          subject: `{{subject}}`,
          heading: "Compra concluída!",
          bodyHtml:
            `<p>Olá, <strong>{{userName}}</strong>! Uma nova compra foi registrada no bot.</p>
             <p>Categoria: <strong>{{categoryName}}</strong></p>
             <p>Cliente: <strong>{{customer}}</strong></p>
             <p>Valor debitado: <strong>{{amount}}</strong></p>
             {{productDetails}}
             {{customerBalance}}`,
          ctaLabel: "Ver histórico de compras",
          ctaUrl: "{{purchasesUrl}}",
          footerText: "Notificação automática do StoreBot",
        },
        {
          subject,
          userName: payload.userName,
          categoryName: payload.categoryName,
          customer: customerLabel,
          amount: amountLabel,
          productDetails: payload.productDetails
            ? `<p>Detalhes do produto:<br /><strong>${payload.productDetails}</strong></p>`
            : "",
          customerBalance: typeof payload.customerBalanceAfter === "number"
            ? `<p>Saldo restante do cliente: <strong>${formatCurrency(payload.customerBalanceAfter)}</strong></p>`
            : "",
          purchasesUrl: `${getAppBaseUrl()}/dashboard/user/compras`,
        },
      );

      const textParts = [
        `Olá, ${payload.userName || "administrador"}!`,
        `Cliente: ${customerLabel}.`,
        `Categoria: ${payload.categoryName}.`,
        `Valor debitado: ${amountLabel}.`,
      ];

      if (payload.productDetails) {
        textParts.push(`Detalhes do produto: ${payload.productDetails}`);
      }

      if (typeof payload.customerBalanceAfter === "number") {
        textParts.push(`Saldo restante do cliente: ${formatCurrency(payload.customerBalanceAfter)}`);
      }

      textParts.push(`Veja mais em ${getAppBaseUrl()}/dashboard/user/compras`);

      await sendEmail({
        to: payload.userEmail,
        subject: finalSubject,
        text: textParts.join("\n"),
        html,
      });
    }

    const metadata: Record<string, unknown> = {
      amount: payload.amount,
      categoryName: payload.categoryName,
      customerName: payload.customerName ?? null,
      customerWhatsapp: payload.customerWhatsapp ?? null,
    };

    if (typeof payload.customerBalanceAfter === "number") {
      metadata.customerBalanceAfter = payload.customerBalanceAfter;
    }

    if (payload.productDetails) {
      metadata.productDetails = payload.productDetails;
    }

    const notification = await createUserNotification({
      userId: payload.userId,
      type: "bot_purchase",
      title: subject,
      message: `${customerLabel} - ${amountLabel}`,
      metadata,
    });

    emitRealtimeNotification(notification);
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      console.warn("[notifications] SMTP não configurado. Notificação de compra ignorada.");
      return;
    }

    if (error instanceof EmailDeliveryError) {
      console.error("[notifications] Falha ao enviar notificação de compra", error);
      return;
    }

    console.error("[notifications] Erro inesperado ao notificar compra", error);
  }
};

export const sendPlanPurchaseNotification = async (payload: {
  planName: string;
  amount: number;
  buyerName: string;
  buyerEmail: string;
  buyerUserId?: number | null;
  adminRecipients?: string[];
}) => {
  if (!payload.buyerEmail) {
    return;
  }

  const amountLabel = formatCurrency(payload.amount);
  const appUrl = `${getAppBaseUrl()}/dashboard/user`;
  try {
    const context = {
      planName: payload.planName,
      amount: amountLabel,
      userName: payload.buyerName || payload.buyerEmail,
      dashboardUrl: appUrl,
    } satisfies Record<string, string>;

    const { subject, html } = await buildEmailFromTemplate(
      "plan_payment_confirmation",
      {
        subject: `Pagamento confirmado - Plano ${payload.planName}`,
        heading: "Acesso liberado!",
        bodyHtml:
          `<p>Olá, <strong>{{userName}}</strong>! Recebemos a confirmação do pagamento do plano <strong>{{planName}}</strong> no valor de <strong>{{amount}}</strong>.</p><p>Seu acesso ao StoreBot foi liberado imediatamente. Comece agora mesmo a configurar suas automações e aproveite os recursos exclusivos do plano selecionado.</p>`,
        ctaLabel: "Ir para o painel",
        ctaUrl: "{{dashboardUrl}}",
        footerText: "Precisa de ajuda? Responda este e-mail e nossa equipe entrará em contato.",
      },
      context,
    );

    const text = [
      `Olá, ${context.userName}!`,
      `Pagamento do plano ${context.planName} confirmado no valor de ${context.amount}.`,
      `Acesse o painel: ${context.dashboardUrl}`,
    ].join("\n");

    await sendEmail({
      to: payload.buyerEmail,
      subject,
      text,
      html,
    });

    if (typeof payload.buyerUserId === "number" && Number.isFinite(payload.buyerUserId)) {
      await createUserNotification({
        userId: payload.buyerUserId,
        type: "plan_payment",
        title: subject,
        message: `${context.planName} - ${context.amount}`,
        metadata: {
          planName: context.planName,
          amount: payload.amount,
        },
      });
    }

    if (payload.adminRecipients && payload.adminRecipients.length > 0) {
      await sendEmail({
        to: payload.adminRecipients,
        subject: `Nova assinatura confirmada - ${payload.planName}`,
        text: `O usuário ${context.userName} concluiu a assinatura do plano ${context.planName} no valor de ${context.amount}.`,
        html: renderEmailTemplate({
          heading: "Nova assinatura registrada",
          bodyHtml: `<p>O usuário <strong>${context.userName}</strong> concluiu a assinatura do plano <strong>${context.planName}</strong> no valor de <strong>${context.amount}</strong>.</p>`,
          ctaLabel: "Ver usuários",
          ctaUrl: `${getAppBaseUrl()}/dashboard/admin/users`,
          footerText: "Notificação automática StoreBot",
        }),
      });
    }
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      console.warn("[notifications] SMTP não configurado. Notificação de assinatura não enviada.");
      return;
    }

    if (error instanceof EmailDeliveryError) {
      console.error("[notifications] Falha ao enviar notificação de assinatura", error);
      return;
    }

    console.error("[notifications] Erro inesperado ao enviar e-mail de assinatura", error);
  }
};
