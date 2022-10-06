import type { GraphQLSchema } from "graphql";
import type { Application } from "express";
import { createServer } from "http";
import { ApolloServer, ServerRegistration } from "apollo-server-express";
import {
  ApolloServerPluginLandingPageGraphQLPlayground,
  ApolloServerPluginDrainHttpServer,
} from "apollo-server-core";
import { defaultPath } from "./config.json";

export const attachGraphQL = async (
  app: Application,
  config: {
    schema?: GraphQLSchema;
    endpoint?: string;
    noServer?: boolean;
    serverConfig?: Omit<ServerRegistration, "app" | "path">;
  } = {}
) => {
  const { schema, endpoint = defaultPath, noServer, serverConfig } = config;

  app.all("*", (req, _, next) => {
    req.graphqlSchema = schema;
    req.graphqlEndpoint = endpoint;

    next();
  });

  if (schema && !noServer) {
    const httpServer = createServer(app);
    const apolloServer = new ApolloServer({
      schema,
      plugins: [
        ApolloServerPluginLandingPageGraphQLPlayground(),
        ApolloServerPluginDrainHttpServer({ httpServer }),
      ],
      csrfPrevention: true,
      cache: "bounded",
      context: (req) => ({ req }),
    });

    await apolloServer.start();

    apolloServer.applyMiddleware({ app, path: endpoint, ...serverConfig });
  }
};
