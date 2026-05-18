import Head from 'next/head';

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>MyForeman</title>
        <meta name="description" content="MyForeman — field service management for crews. Customers, jobs, invoices, and crew payroll in one place." />
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <meta name="theme-color" content="#111827" />
        <meta property="og:title" content="MyForeman" />
        <meta property="og:description" content="Field service management for crews." />
        <meta property="og:type" content="website" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
