do {
    def(sum,  // function
      -> { nums, 
        do {
           := (i, 0), // Creates a local variable i and sets to 0
           := (s, 0), // Creates local var s and sets to 0
           while { <(i, length(nums)),
             do { =(s, +(s, element(nums, i))),
                =(i, +(i, 1))
             }
           },
           s
        }
      }
   ),
   println(+("sum(array(1, 2, 3)) := ", sum(array(1, 2, 3))))
}