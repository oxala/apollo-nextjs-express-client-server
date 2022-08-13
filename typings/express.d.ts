import type { GraphQLSchema } from "graphql";

declare global {
  namespace Express {
    interface Request {
      graphqlSchema?: GraphQLSchema;
      graphqlEndpoint?: string;
    }
  }
}
