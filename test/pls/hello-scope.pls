println("computed value = ", 
  do(
    def(x,4),
    def(inc, fn(w, do(
        def(y, 999),
        +(w,1)
      ) // do
    ) // fun
    ),// def
    def(z,-1),
    set(x, inc(x))
  )
)