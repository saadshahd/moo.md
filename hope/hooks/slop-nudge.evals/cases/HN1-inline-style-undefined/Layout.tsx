type LayoutProps = {
  spanCol?: number;
  spanRow?: number;
  grow?: boolean;
};

const span = (n: number) => `span ${n}`;

export const Layout = ({
  layout,
  children,
}: {
  layout?: LayoutProps;
  children: React.ReactNode;
}) => (
  <div
    style={{
      gridColumn: layout?.spanCol ? span(layout.spanCol) : undefined,
      gridRow: layout?.spanRow ? span(layout.spanRow) : undefined,
      flex: layout?.grow ? "1 1 0" : undefined,
    }}
  >
    {children}
  </div>
);
