import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  NormalizedCacheObject,
} from "@apollo/client/index.js";
import { NextPage, NextPageContext } from "next";
import React, { ComponentProps } from "react";
import { SchemaLink } from "@apollo/client/link/schema/index.js";
import { Request } from "express";
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
  } = {}
) => {
  const { link, uri = defaultPath } = config;
  const cache = new InMemoryCache().restore(apolloState);

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

export const withApollo = (Page: NextPage, config: { ssr?: boolean } = {}) => {
  const { ssr = true } = config;
  type WithApolloProps = Props & ComponentProps<typeof Page>;

  const WithApollo: NextPage<WithApolloProps> = ({
    apolloClient,
    apolloState,
    apolloConfig,
    ...pageProps
  }) => {
    const client = apolloClient || getClient(apolloState, apolloConfig);

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

        apolloClient = getClient(undefined, {
          link: new SchemaLink({ schema, context }),
        });
      } else {
        apolloClient = getClient(undefined, { uri });
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
