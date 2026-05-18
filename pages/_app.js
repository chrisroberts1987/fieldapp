import Head from 'next/head';

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>MyForeman — From lead to paid</title>
        <meta name="description" content="Run your field service business from first call to final payment — with AI insights that help you grow." />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <meta name="theme-color" content="#111827" />
        <meta property="og:title" content="MyForeman — From lead to paid" />
        <meta property="og:description" content="Run your field service business from first call to final payment — with AI insights that help you grow." />
        <meta property="og:type" content="website" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
