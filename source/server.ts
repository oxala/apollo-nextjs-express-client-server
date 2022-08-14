import type { GraphQLSchema } from "graphql";
import type { Application } from "express";
import { createServer } from "http";
import { ApolloServer } from "apollo-server-express";
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
  } = {}
) => {
  const { schema, endpoint = defaultPath } = config;

  app.all("*", (req, _, next) => {
    req.graphqlSchema = schema;
    req.graphqlEndpoint = endpoint;

    next();
  });

  if (schema) {
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

    apolloServer.applyMiddleware({ app, path: endpoint });
  }
};
