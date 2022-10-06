import type { Request } from "express";
import type { NextPage, NextPageContext } from "next";
import type { SchemaLink } from "@apollo/client/link/schema";
import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  InMemoryCacheConfig,
  NormalizedCacheObject,
} from "@apollo/client/index.js";
import React, { ComponentProps } from "react";
import { defaultPath } from "./config.json";

interface Props {
  apolloState?: NormalizedCacheObject;
  apolloClient?: ApolloClient<NormalizedCacheObject>;
  apolloConfig: {
    uri: string;
  };
}

let cachedApolloClient: ApolloClient<NormalizedCacheObject>;

const getClient = (
  apolloState: NormalizedCacheObject = {},
  config: {
    link?: SchemaLink;
    uri?: string;
  } = {},
  cacheConfig?: InMemoryCacheConfig
) => {
  const { link, uri = defaultPath } = config;
  const cache = new InMemoryCache(cacheConfig).restore(apolloState);

  if (typeof window === "undefined") {
    return new ApolloClient({ ssrMode: true, cache, link });
  }

  if (!cachedApolloClient) {
    cachedApolloClient = new ApolloClient({
      cache,
      credentials: "same-origin",
      uri,
    });
  }

  return cachedApolloClient;
};

export const withApollo = (
  Page: NextPage,
  config: { ssr?: boolean; cacheConfig?: InMemoryCacheConfig } = {}
) => {
  const { ssr = true, cacheConfig } = config;
  type WithApolloProps = Props & ComponentProps<typeof Page>;

  const WithApollo: NextPage<WithApolloProps> = ({
    apolloClient,
    apolloState,
    apolloConfig,
    ...pageProps
  }) => {
    const client =
      apolloClient || getClient(apolloState, apolloConfig, cacheConfig);

    return (
      <ApolloProvider client={client}>
        <Page {...pageProps} />
      </ApolloProvider>
    );
  };

  if (ssr || Page.getInitialProps) {
    WithApollo.getInitialProps = async (context: NextPageContext) => {
      const { AppTree, req, res } = context;
      const schema = req && (req as Request).graphqlSchema;
      const uri = (req && (req as Request).graphqlEndpoint) || defaultPath;
      let apolloClient: ApolloClient<NormalizedCacheObject>;
      let pageProps = {};

      if (schema) {
        const { SchemaLink } = await import(
          "@apollo/client/link/schema/index.js"
        );

        apolloClient = getClient(
          undefined,
          {
            link: new SchemaLink({ schema, context }),
          },
          cacheConfig
        );
      } else {
        apolloClient = getClient(undefined, { uri }, cacheConfig);
      }

      if (Page.getInitialProps) {
        pageProps = await Page.getInitialProps(context);
      }

      if (typeof window === "undefined") {
        if (res?.writableEnded) {
          return { ...pageProps, apolloConfig: { uri } };
        }

        if (ssr && schema) {
          try {
            const { getMarkupFromTree } = await import(
              "@apollo/client/react/ssr/getDataFromTree.js"
            );
            const { renderToStaticMarkup } = await import("react-dom/server");

            await getMarkupFromTree({
              tree: (
                <AppTree
                  pageProps={{
                    ...pageProps,
                    apolloClient,
                  }}
                />
              ),
              context: {},
              renderFunction: renderToStaticMarkup,
            });
          } catch (exception) {
            console.log("Apollo SSR Error:", exception);
          }
        }
      }

      return {
        ...pageProps,
        apolloState: apolloClient.cache.extract(),
        apolloConfig: { uri },
      };
    };
  }

  return WithApollo;
};

export const useClient = () => cachedApolloClient;
