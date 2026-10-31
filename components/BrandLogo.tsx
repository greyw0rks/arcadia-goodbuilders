export function BrandLogo({ inverse = false }: { inverse?: boolean }) {
  return <img className="wordmark-logo" src={inverse ? "/brand/arcadia-logo-white.svg" : "/brand/arcadia-logo.svg"} alt="" width={168} height={44} />;
}
