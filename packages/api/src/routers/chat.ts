/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { trpcRouter } from '../init.js';
import { putChat } from '../procedures/chat.js';

export const chatRouter = trpcRouter({
  put: putChat,
});
