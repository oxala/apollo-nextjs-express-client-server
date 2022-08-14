import type { Application, NextFunction, Request } from "express";
import { GraphQLSchema } from "graphql";
import { defaultPath } from "../config.json";
import { when } from "jest-when";
import { createServer } from "http";
import { ApolloServer, ExpressContext } from "apollo-server-express";
import {
  ApolloServerPluginDrainHttpServer,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from "apollo-server-core";

const { attachGraphQL } = jest.requireActual("../server");

jest.mock("http", () => ({
  ...jest.requireActual("http"),
  createServer: jest.fn(),
}));
jest.mock("apollo-server-express");
jest.mock("apollo-server-core");

describe("Given express application", () => {
  let application: Application;
  let applicationAll: jest.Mock<Application["all"]>;
  let req: Request;
  let next: jest.Mock<NextFunction>;

  beforeEach(() => {
    applicationAll = jest.fn();
    req = {} as Request;
    next = jest.fn();

    application = { all: applicationAll } as unknown as Application;
  });

  describe("Given custom graphql endpoint", () => {
    const endpoint = "/api/graphql";

    it("should attach the endpoint to the request object", async () => {
      await attachGraphQL(application, { endpoint });

      expect(applicationAll).toBeCalledWith("*", expect.any(Function));

      applicationAll.mock.calls[0][1](req, {}, next);

      expect(req.graphqlEndpoint).toBe(endpoint);
      expect(next).toBeCalledWith();
    });
  });

  describe("Given graphql schema", () => {
    const schema = "schema" as unknown as GraphQLSchema;

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it("should attach the schema and default endpoint to the request object", async () => {
      await attachGraphQL(application, { schema });

      expect(applicationAll).toBeCalledWith("*", expect.any(Function));

      applicationAll.mock.calls[0][1](req, {}, next);

      expect(req.graphqlEndpoint).toBe(defaultPath);
      expect(req.graphqlSchema).toBe(schema);
    });

    it("should start graphql server and apply it to the middleware", async () => {
      const mockedApolloServer = ApolloServer as jest.Mock<ApolloServer>;
      const httpServer = createServer(application);
      const mockStart: jest.Mock<ApolloServer<ExpressContext>["start"]> =
        jest.fn();
      const mockApplyMiddleware: jest.Mock<
        ApolloServer<ExpressContext>["applyMiddleware"]
      > = jest.fn();

      mockedApolloServer.mockImplementation(
        () =>
          ({
            start: mockStart,
            applyMiddleware: mockApplyMiddleware,
          } as unknown as ApolloServer<ExpressContext>)
      );

      when(createServer as any)
        .calledWith(application)
        .mockReturnValue(httpServer);

      when(ApolloServerPluginLandingPageGraphQLPlayground)
        .calledWith()
        .mockReturnValue(
          "ApolloServerPluginLandingPageGraphQLPlayground" as any
        );

      when(ApolloServerPluginDrainHttpServer)
        .calledWith({ httpServer })
        .mockReturnValue("ApolloServerPluginDrainHttpServer" as any);

      await attachGraphQL(application, { schema });

      const ApolloServerCall = mockedApolloServer.mock.calls[0][0];

      expect(ApolloServerCall).toMatchSnapshot();
      expect(ApolloServerCall.context(req)).toEqual({ req });
      expect(mockStart).toBeCalled();
      expect(mockApplyMiddleware).toBeCalledWith({
        app: application,
        path: defaultPath,
      });
    });
  });
});
