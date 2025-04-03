import { z } from 'zod';


// Esse arquivo define os esquemas de validação para as mensagens que serão enviadas entre os nós da rede.


// Tipagem basica de uma mensagem
export const BaseMessageSchema = z.object({
    type: z.string(),
    sender_name: z.string(),
})

// Request enviado toda vez que um nó esta inicializando e deseja entrar na rede
export const JoinNetworkRequestSchema = BaseMessageSchema.extend({
    type: z.literal('join_network_request'),
})
export type JoinNetworkRequest = z.infer<typeof JoinNetworkRequestSchema>


// Resposta enviada pelo dono do token para o nó que deseja entrar na rede
export const JoinNetworkResponseSchema = BaseMessageSchema.extend({
    type: z.literal('join_network_response'),
    requester_node_name: z.string(),
})
export type JoinNetworkResponse = z.infer<typeof JoinNetworkResponseSchema>



// Mensagem de chat
export const ChatMessageSchema = BaseMessageSchema.extend({
    type: z.literal('chat_message'),
    message: z.string(),
    index: z.number().int().nonnegative(),
})
export type ChatMessage = z.infer<typeof ChatMessageSchema>



export const RequestChatMessageHistorySchema = BaseMessageSchema.extend({
    type: z.literal('request_chat_message_history'),
    requestedIndexes: z.array(z.number().int().nonnegative()),
})
export type RequestChatMessageHistory = z.infer<typeof RequestChatMessageHistorySchema>


export const MessageHistoryAnnouncementSchema = BaseMessageSchema.extend({
    type: z.literal('message_history_announcement'),
    messages: z.array(ChatMessageSchema),
})
export type MessageHistoryAnnouncement = z.infer<typeof MessageHistoryAnnouncementSchema>


export const PassTokenMessageSchema = BaseMessageSchema.extend({
    type: z.literal('pass_token'),
    target: z.string(),
    message_index: z.number().int().nonnegative(),
    node_list: z.array(z.string()),
});
export type PassTokenMessage = z.infer<typeof PassTokenMessageSchema>





export const MessageUnionSchema = z.discriminatedUnion('type', [
    JoinNetworkRequestSchema,
    JoinNetworkResponseSchema,
    PassTokenMessageSchema,
    RequestChatMessageHistorySchema,
    MessageHistoryAnnouncementSchema,
    ChatMessageSchema,
])
export type MessageUnion = z.infer<typeof MessageUnionSchema>



