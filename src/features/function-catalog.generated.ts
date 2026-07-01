/**
 * AUTO-GENERATED from Univer's formula catalog (@univerjs/sheets-formula).
 * Do not edit by hand. Regenerate: node scripts/gen-function-catalog.mjs
 * 529 functions across 13 categories — every one is evaluated
 * by Univer's engine when typed (=NAME(...)).
 */
export interface CatalogFn { name: string; hint: string }
export interface CatalogCategory { category: string; fns: CatalogFn[] }
export const FULL_FUNCTION_CATEGORIES: CatalogCategory[] = [
  {
    "category": "Math",
    "fns": [
      {
        "name": "ABS",
        "hint": "Returns the absolute value of a number"
      },
      {
        "name": "ACOS",
        "hint": "Returns the arccosine of a number"
      },
      {
        "name": "ACOSH",
        "hint": "Returns the inverse hyperbolic cosine of a number"
      },
      {
        "name": "ACOT",
        "hint": "Returns the arccotangent of a number"
      },
      {
        "name": "ACOTH",
        "hint": "Returns the hyperbolic arccotangent of a number"
      },
      {
        "name": "AGGREGATE",
        "hint": "Returns an aggregate in a list or database"
      },
      {
        "name": "ARABIC",
        "hint": "Converts a Roman number to Arabic, as a number"
      },
      {
        "name": "ASIN",
        "hint": "Returns the arcsine of a number"
      },
      {
        "name": "ASINH",
        "hint": "Returns the inverse hyperbolic sine of a number"
      },
      {
        "name": "ATAN",
        "hint": "Returns the arctangent of a number"
      },
      {
        "name": "ATAN2",
        "hint": "Returns the arctangent from x- and y-coordinates"
      },
      {
        "name": "ATANH",
        "hint": "Returns the inverse hyperbolic tangent of a number"
      },
      {
        "name": "BASE",
        "hint": "Converts a number into a text representation with the given radix (base)"
      },
      {
        "name": "CEILING",
        "hint": "Rounds a number to the nearest integer or to the nearest multiple of significanc"
      },
      {
        "name": "CEILING_MATH",
        "hint": "Rounds a number up, to the nearest integer or to the nearest multiple of signifi"
      },
      {
        "name": "CEILING_PRECISE",
        "hint": "Rounds a number the nearest integer or to the nearest multiple of significance. "
      },
      {
        "name": "COMBIN",
        "hint": "Returns the number of combinations for a given number of objects"
      },
      {
        "name": "COMBINA",
        "hint": "Returns the number of combinations with repetitions for a given number of items"
      },
      {
        "name": "COS",
        "hint": "Returns the cosine of a number"
      },
      {
        "name": "COSH",
        "hint": "Returns the hyperbolic cosine of a number"
      },
      {
        "name": "COT",
        "hint": "Returns the cotangent of an angle"
      },
      {
        "name": "COTH",
        "hint": "Returns the hyperbolic cotangent of a number"
      },
      {
        "name": "CSC",
        "hint": "Returns the cosecant of an angle"
      },
      {
        "name": "CSCH",
        "hint": "Returns the hyperbolic cosecant of an angle"
      },
      {
        "name": "DECIMAL",
        "hint": "Converts a text representation of a number in a given base into a decimal number"
      },
      {
        "name": "DEGREES",
        "hint": "Converts radians to degrees"
      },
      {
        "name": "EVEN",
        "hint": "Rounds a number up to the nearest even integer"
      },
      {
        "name": "EXP",
        "hint": "Returns e raised to the power of a given number"
      },
      {
        "name": "FACT",
        "hint": "Returns the factorial of a number"
      },
      {
        "name": "FACTDOUBLE",
        "hint": "Returns the double factorial of a number"
      },
      {
        "name": "FLOOR",
        "hint": "Rounds a number down, toward zero"
      },
      {
        "name": "FLOOR_MATH",
        "hint": "Rounds a number down, to the nearest integer or to the nearest multiple of signi"
      },
      {
        "name": "FLOOR_PRECISE",
        "hint": "Rounds a number down to the nearest integer or to the nearest multiple of signif"
      },
      {
        "name": "GCD",
        "hint": "Returns the greatest common divisor"
      },
      {
        "name": "INT",
        "hint": "Rounds a number down to the nearest integer"
      },
      {
        "name": "ISO_CEILING",
        "hint": "Returns a number that is rounded up to the nearest integer or to the nearest mul"
      },
      {
        "name": "LCM",
        "hint": "Returns the least common multiple"
      },
      {
        "name": "LET",
        "hint": "Assigns names to calculation results to allow storing intermediate calculations,"
      },
      {
        "name": "LN",
        "hint": "Returns the natural logarithm of a number"
      },
      {
        "name": "LOG",
        "hint": "Returns the logarithm of a number to a specified base"
      },
      {
        "name": "LOG10",
        "hint": "Returns the base-10 logarithm of a number"
      },
      {
        "name": "MDETERM",
        "hint": "Returns the matrix determinant of an array"
      },
      {
        "name": "MINVERSE",
        "hint": "Returns the matrix inverse of an array"
      },
      {
        "name": "MMULT",
        "hint": "Returns the matrix product of two arrays"
      },
      {
        "name": "MOD",
        "hint": "Returns the remainder from division"
      },
      {
        "name": "MROUND",
        "hint": "Returns a number rounded to the desired multiple"
      },
      {
        "name": "MULTINOMIAL",
        "hint": "Returns the multinomial of a set of numbers"
      },
      {
        "name": "MUNIT",
        "hint": "Returns the unit matrix or the specified dimension"
      },
      {
        "name": "ODD",
        "hint": "Rounds a number up to the nearest odd integer"
      },
      {
        "name": "PI",
        "hint": "Returns the value of pi"
      },
      {
        "name": "POWER",
        "hint": "Returns the result of a number raised to a power"
      },
      {
        "name": "PRODUCT",
        "hint": "Multiplies its arguments"
      },
      {
        "name": "QUOTIENT",
        "hint": "Returns the integer portion of a division"
      },
      {
        "name": "RADIANS",
        "hint": "Converts degrees to radians"
      },
      {
        "name": "RAND",
        "hint": "Returns a random number between 0 and 1"
      },
      {
        "name": "RANDARRAY",
        "hint": "Returns an array of random numbers between 0 and 1."
      },
      {
        "name": "RANDBETWEEN",
        "hint": "Returns a random number between the numbers you specify"
      },
      {
        "name": "ROMAN",
        "hint": "Converts an Arabic numeral to Roman, as text"
      },
      {
        "name": "ROUND",
        "hint": "Rounds a number to a specified number of digits"
      },
      {
        "name": "ROUNDBANK",
        "hint": "Rounds a number in banker's rounding"
      },
      {
        "name": "ROUNDDOWN",
        "hint": "Rounds a number down, toward zero"
      },
      {
        "name": "ROUNDUP",
        "hint": "Rounds a number up, away from zero"
      },
      {
        "name": "SEC",
        "hint": "Returns the secant of an angle"
      },
      {
        "name": "SECH",
        "hint": "Returns the hyperbolic secant of an angle"
      },
      {
        "name": "SERIESSUM",
        "hint": "Returns the sum of a power series based on the formula"
      },
      {
        "name": "SEQUENCE",
        "hint": "Generates a list of sequential numbers in an array, such as 1, 2, 3, 4"
      },
      {
        "name": "SIGN",
        "hint": "Returns the sign of a number"
      },
      {
        "name": "SIN",
        "hint": "Returns the sine of the given angle"
      },
      {
        "name": "SINH",
        "hint": "Returns the hyperbolic sine of a number"
      },
      {
        "name": "SQRT",
        "hint": "Returns a positive square root"
      },
      {
        "name": "SQRTPI",
        "hint": "Returns the square root of (number * pi)"
      },
      {
        "name": "SUBTOTAL",
        "hint": "Returns a subtotal in a list or database"
      },
      {
        "name": "SUM",
        "hint": "Adds its arguments"
      },
      {
        "name": "SUMIF",
        "hint": "Adds the cells specified by a given criteria"
      },
      {
        "name": "SUMIFS",
        "hint": "Adds all of its arguments that meet multiple criteria."
      },
      {
        "name": "SUMPRODUCT",
        "hint": "Returns the sum of the products of corresponding array components"
      },
      {
        "name": "SUMSQ",
        "hint": "Returns the sum of the squares of the arguments"
      },
      {
        "name": "SUMX2MY2",
        "hint": "Returns the sum of the difference of squares of corresponding values in two arra"
      },
      {
        "name": "SUMX2PY2",
        "hint": "Returns the sum of the sum of squares of corresponding values in two arrays"
      },
      {
        "name": "SUMXMY2",
        "hint": "Returns the sum of squares of differences of corresponding values in two arrays"
      },
      {
        "name": "TAN",
        "hint": "Returns the tangent of a number"
      },
      {
        "name": "TANH",
        "hint": "Returns the hyperbolic tangent of a number"
      },
      {
        "name": "TRUNC",
        "hint": "Truncates a number to an integer"
      }
    ]
  },
  {
    "category": "Statistical",
    "fns": [
      {
        "name": "AVEDEV",
        "hint": "Returns the average of the absolute deviations of data points from their mean"
      },
      {
        "name": "AVERAGE",
        "hint": "Returns the average of its arguments"
      },
      {
        "name": "AVERAGE_WEIGHTED",
        "hint": "Finds the weighted average of a set of values, given the values and the correspo"
      },
      {
        "name": "AVERAGEA",
        "hint": "Returns the average of its arguments, including numbers, text, and logical value"
      },
      {
        "name": "AVERAGEIF",
        "hint": "Returns the average (arithmetic mean) of all the cells in a range that meet a gi"
      },
      {
        "name": "AVERAGEIFS",
        "hint": "Returns the average (arithmetic mean) of all cells that meet multiple criteria"
      },
      {
        "name": "BETA_DIST",
        "hint": "Returns the beta cumulative distribution function"
      },
      {
        "name": "BETA_INV",
        "hint": "Returns the inverse of the cumulative distribution function for a specified beta"
      },
      {
        "name": "BINOM_DIST",
        "hint": "Returns the individual term binomial distribution probability"
      },
      {
        "name": "BINOM_DIST_RANGE",
        "hint": "Returns the probability of a trial result using a binomial distribution"
      },
      {
        "name": "BINOM_INV",
        "hint": "Returns the smallest value for which the cumulative binomial distribution is les"
      },
      {
        "name": "CHISQ_DIST",
        "hint": "Returns the left-tailed probability of the chi-squared distribution."
      },
      {
        "name": "CHISQ_DIST_RT",
        "hint": "Returns the right-tailed probability of the chi-squared distribution."
      },
      {
        "name": "CHISQ_INV",
        "hint": "Returns the inverse of the left-tailed probability of the chi-squared distributi"
      },
      {
        "name": "CHISQ_INV_RT",
        "hint": "Returns the inverse of the right-tailed probability of the chi-squared distribut"
      },
      {
        "name": "CHISQ_TEST",
        "hint": "Returns the test for independence"
      },
      {
        "name": "CONFIDENCE_NORM",
        "hint": "Returns the confidence interval for a population mean, using a normal distributi"
      },
      {
        "name": "CONFIDENCE_T",
        "hint": "Returns the confidence interval for a population mean, using a Student's t distr"
      },
      {
        "name": "CORREL",
        "hint": "Returns the correlation coefficient between two data sets"
      },
      {
        "name": "COUNT",
        "hint": "Counts how many numbers are in the list of arguments"
      },
      {
        "name": "COUNTA",
        "hint": "Counts how many values are in the list of arguments"
      },
      {
        "name": "COUNTBLANK",
        "hint": "Counts the number of blank cells within a range"
      },
      {
        "name": "COUNTIF",
        "hint": "Counts the number of cells within a range that meet the given criteria"
      },
      {
        "name": "COUNTIFS",
        "hint": "Counts the number of cells within a range that meet multiple criteria"
      },
      {
        "name": "COVARIANCE_P",
        "hint": "Returns population covariance"
      },
      {
        "name": "COVARIANCE_S",
        "hint": "Returns the sample covariance"
      },
      {
        "name": "DEVSQ",
        "hint": "Returns the sum of squares of deviations"
      },
      {
        "name": "EXPON_DIST",
        "hint": "Returns the exponential distribution"
      },
      {
        "name": "F_DIST",
        "hint": "Returns the F probability distribution"
      },
      {
        "name": "F_DIST_RT",
        "hint": "Returns the (right-tailed) F probability distribution"
      },
      {
        "name": "F_INV",
        "hint": "Returns the inverse of the F probability distribution"
      },
      {
        "name": "F_INV_RT",
        "hint": "Returns the inverse of the (right-tailed) F probability distribution"
      },
      {
        "name": "F_TEST",
        "hint": "Returns the result of an F-test"
      },
      {
        "name": "FISHER",
        "hint": "Returns the Fisher transformation"
      },
      {
        "name": "FISHERINV",
        "hint": "Returns the inverse of the Fisher transformation"
      },
      {
        "name": "FORECAST",
        "hint": "Returns a value along a linear trend"
      },
      {
        "name": "FORECAST_ETS",
        "hint": "Returns a future value based on existing (historical) values by using the AAA ve"
      },
      {
        "name": "FORECAST_ETS_CONFINT",
        "hint": "Returns a confidence interval for the forecast value at the specified target dat"
      },
      {
        "name": "FORECAST_ETS_SEASONALITY",
        "hint": "Returns the length of the repetitive pattern Excel detects for the specified tim"
      },
      {
        "name": "FORECAST_ETS_STAT",
        "hint": "Returns a statistical value as a result of time series forecasting"
      },
      {
        "name": "FORECAST_LINEAR",
        "hint": "Returns a future value based on existing values"
      },
      {
        "name": "FREQUENCY",
        "hint": "Returns a frequency distribution as a vertical array"
      },
      {
        "name": "GAMMA",
        "hint": "Returns the Gamma function value"
      },
      {
        "name": "GAMMA_DIST",
        "hint": "Returns the gamma distribution"
      },
      {
        "name": "GAMMA_INV",
        "hint": "Returns the inverse of the gamma cumulative distribution"
      },
      {
        "name": "GAMMALN",
        "hint": "Returns the natural logarithm of the gamma function, Γ(x)"
      },
      {
        "name": "GAMMALN_PRECISE",
        "hint": "Returns the natural logarithm of the gamma function, Γ(x)"
      },
      {
        "name": "GAUSS",
        "hint": "Returns 0.5 less than the standard normal cumulative distribution"
      },
      {
        "name": "GEOMEAN",
        "hint": "Returns the geometric mean"
      },
      {
        "name": "GROWTH",
        "hint": "Returns values along an exponential trend"
      },
      {
        "name": "HARMEAN",
        "hint": "Returns the harmonic mean"
      },
      {
        "name": "HYPGEOM_DIST",
        "hint": "Returns the hypergeometric distribution"
      },
      {
        "name": "INTERCEPT",
        "hint": "Returns the intercept of the linear regression line"
      },
      {
        "name": "KURT",
        "hint": "Returns the kurtosis of a data set"
      },
      {
        "name": "LARGE",
        "hint": "Returns the k-th largest value in a data set"
      },
      {
        "name": "LINEST",
        "hint": "Returns the parameters of a linear trend"
      },
      {
        "name": "LOGEST",
        "hint": "Returns the parameters of an exponential trend"
      },
      {
        "name": "LOGNORM_DIST",
        "hint": "Returns the cumulative lognormal distribution"
      },
      {
        "name": "LOGNORM_INV",
        "hint": "Returns the inverse of the lognormal cumulative distribution"
      },
      {
        "name": "MARGINOFERROR",
        "hint": "Calculates the margin of error from a range of values and a confidence level."
      },
      {
        "name": "MAX",
        "hint": "Returns the maximum value in a list of arguments"
      },
      {
        "name": "MAXA",
        "hint": "Returns the maximum value in a list of arguments, including numbers, text, and l"
      },
      {
        "name": "MAXIFS",
        "hint": "Returns the maximum value among cells specified by a given set of conditions or "
      },
      {
        "name": "MEDIAN",
        "hint": "Returns the median of the given numbers"
      },
      {
        "name": "MIN",
        "hint": "Returns the minimum value in a list of arguments"
      },
      {
        "name": "MINA",
        "hint": "Returns the smallest value in a list of arguments, including numbers, text, and "
      },
      {
        "name": "MINIFS",
        "hint": "Returns the minimum value among cells specified by a given set of conditions or "
      },
      {
        "name": "MODE_MULT",
        "hint": "Returns a vertical array of the most frequently occurring, or repetitive values "
      },
      {
        "name": "MODE_SNGL",
        "hint": "Returns the most common value in a data set"
      },
      {
        "name": "NEGBINOM_DIST",
        "hint": "Returns the negative binomial distribution"
      },
      {
        "name": "NORM_DIST",
        "hint": "Returns the normal cumulative distribution"
      },
      {
        "name": "NORM_INV",
        "hint": "Returns the inverse of the normal cumulative distribution"
      },
      {
        "name": "NORM_S_DIST",
        "hint": "Returns the standard normal cumulative distribution"
      },
      {
        "name": "NORM_S_INV",
        "hint": "Returns the inverse of the standard normal cumulative distribution"
      },
      {
        "name": "PEARSON",
        "hint": "Returns the Pearson product moment correlation coefficient"
      },
      {
        "name": "PERCENTILE_EXC",
        "hint": "Returns the k-th percentile of values in a data set (Excludes 0 and 1)."
      },
      {
        "name": "PERCENTILE_INC",
        "hint": "Returns the k-th percentile of values in a data set (Includes 0 and 1)"
      },
      {
        "name": "PERCENTRANK_EXC",
        "hint": "Returns the percentage rank of a value in a data set (Excludes 0 and 1)"
      },
      {
        "name": "PERCENTRANK_INC",
        "hint": "Returns the percentage rank of a value in a data set (Includes 0 and 1)"
      },
      {
        "name": "PERMUT",
        "hint": "Returns the number of permutations for a given number of objects"
      },
      {
        "name": "PERMUTATIONA",
        "hint": "Returns the number of permutations for a given number of objects (with repetitio"
      },
      {
        "name": "PHI",
        "hint": "Returns the value of the density function for a standard normal distribution"
      },
      {
        "name": "POISSON_DIST",
        "hint": "Returns the Poisson distribution"
      },
      {
        "name": "PROB",
        "hint": "Returns the probability that values in a range are between two limits"
      },
      {
        "name": "QUARTILE_EXC",
        "hint": "Returns the quartile of a data set (Excludes 0 and 1)"
      },
      {
        "name": "QUARTILE_INC",
        "hint": "Returns the quartile of a data set (Includes 0 and 1)"
      },
      {
        "name": "RANK_AVG",
        "hint": "Returns the rank of a number in a list of numbers"
      },
      {
        "name": "RANK_EQ",
        "hint": "Returns the rank of a number in a list of numbers"
      },
      {
        "name": "RSQ",
        "hint": "Returns the square of the Pearson product moment correlation coefficient"
      },
      {
        "name": "SKEW",
        "hint": "Returns the skewness of a distribution"
      },
      {
        "name": "SKEW_P",
        "hint": "Returns the skewness of a distribution based on a population"
      },
      {
        "name": "SLOPE",
        "hint": "Returns the slope of the linear regression line"
      },
      {
        "name": "SMALL",
        "hint": "Returns the k-th smallest value in a data set"
      },
      {
        "name": "STANDARDIZE",
        "hint": "Returns a normalized value"
      },
      {
        "name": "STDEV_P",
        "hint": "Calculates standard deviation based on the entire population"
      },
      {
        "name": "STDEV_S",
        "hint": "Estimates standard deviation based on a sample"
      },
      {
        "name": "STDEVA",
        "hint": "Estimates standard deviation based on a sample, including numbers, text, and log"
      },
      {
        "name": "STDEVPA",
        "hint": "Calculates standard deviation based on the entire population, including numbers,"
      },
      {
        "name": "STEYX",
        "hint": "Returns the standard error of the predicted y-value for each x in the regression"
      },
      {
        "name": "T_DIST",
        "hint": "Returns the probability for the Student t-distribution"
      },
      {
        "name": "T_DIST_2T",
        "hint": "Returns the probability for the Student t-distribution (two-tailed)"
      },
      {
        "name": "T_DIST_RT",
        "hint": "Returns the probability for the Student t-distribution (right-tailed)"
      },
      {
        "name": "T_INV",
        "hint": "Returns the inverse of the probability for the Student t-distribution"
      },
      {
        "name": "T_INV_2T",
        "hint": "Returns the inverse of the probability for the Student t-distribution (two-taile"
      },
      {
        "name": "T_TEST",
        "hint": "Returns the probability associated with a Student's t-test"
      },
      {
        "name": "TREND",
        "hint": "Returns values along a linear trend"
      },
      {
        "name": "TRIMMEAN",
        "hint": "Returns the mean of the interior of a data set"
      },
      {
        "name": "VAR_P",
        "hint": "Calculates variance based on the entire population"
      },
      {
        "name": "VAR_S",
        "hint": "Estimates variance based on a sample"
      },
      {
        "name": "VARA",
        "hint": "Estimates variance based on a sample, including numbers, text, and logical value"
      },
      {
        "name": "VARPA",
        "hint": "Calculates variance based on the entire population, including numbers, text, and"
      },
      {
        "name": "WEIBULL_DIST",
        "hint": "Returns the Weibull distribution"
      },
      {
        "name": "Z_TEST",
        "hint": "Returns the one-tailed probability-value of a z-test"
      }
    ]
  },
  {
    "category": "Financial",
    "fns": [
      {
        "name": "ACCRINT",
        "hint": "Returns the accrued interest for a security that pays periodic interest"
      },
      {
        "name": "ACCRINTM",
        "hint": "Returns the accrued interest for a security that pays interest at maturity"
      },
      {
        "name": "AMORDEGRC",
        "hint": "Returns the depreciation for each accounting period by using a depreciation coef"
      },
      {
        "name": "AMORLINC",
        "hint": "Returns the depreciation for each accounting period"
      },
      {
        "name": "COUPDAYBS",
        "hint": "Returns the number of days from the beginning of the coupon period to the settle"
      },
      {
        "name": "COUPDAYS",
        "hint": "Returns the number of days in the coupon period that contains the settlement dat"
      },
      {
        "name": "COUPDAYSNC",
        "hint": "Returns the number of days from the settlement date to the next coupon date"
      },
      {
        "name": "COUPNCD",
        "hint": "Returns the next coupon date after the settlement date"
      },
      {
        "name": "COUPNUM",
        "hint": "Returns the number of coupons payable between the settlement date and maturity d"
      },
      {
        "name": "COUPPCD",
        "hint": "Returns the previous coupon date before the settlement date"
      },
      {
        "name": "CUMIPMT",
        "hint": "Returns the cumulative interest paid between two periods"
      },
      {
        "name": "CUMPRINC",
        "hint": "Returns the cumulative principal paid on a loan between two periods"
      },
      {
        "name": "DB",
        "hint": "Returns the depreciation of an asset for a specified period by using the fixed-d"
      },
      {
        "name": "DDB",
        "hint": "Returns the depreciation of an asset for a specified period by using the double-"
      },
      {
        "name": "DISC",
        "hint": "Returns the discount rate for a security"
      },
      {
        "name": "DOLLARDE",
        "hint": "Converts a dollar price, expressed as a fraction, into a dollar price, expressed"
      },
      {
        "name": "DOLLARFR",
        "hint": "Converts a dollar price, expressed as a decimal number, into a dollar price, exp"
      },
      {
        "name": "DURATION",
        "hint": "Returns the annual duration of a security with periodic interest payments"
      },
      {
        "name": "EFFECT",
        "hint": "Returns the effective annual interest rate"
      },
      {
        "name": "FV",
        "hint": "Returns the future value of an investment"
      },
      {
        "name": "FVSCHEDULE",
        "hint": "Returns the future value of an initial principal after applying a series of comp"
      },
      {
        "name": "INTRATE",
        "hint": "Returns the interest rate for a fully invested security"
      },
      {
        "name": "IPMT",
        "hint": "Returns the interest payment for an investment for a given period"
      },
      {
        "name": "IRR",
        "hint": "Returns the internal rate of return for a series of cash flows"
      },
      {
        "name": "ISPMT",
        "hint": "Calculates the interest paid during a specific period of an investment"
      },
      {
        "name": "MDURATION",
        "hint": "Returns the Macauley modified duration for a security with an assumed par value "
      },
      {
        "name": "MIRR",
        "hint": "Returns the internal rate of return where positive and negative cash flows are f"
      },
      {
        "name": "NOMINAL",
        "hint": "Returns the annual nominal interest rate"
      },
      {
        "name": "NPER",
        "hint": "Returns the number of periods for an investment"
      },
      {
        "name": "NPV",
        "hint": "Returns the net present value of an investment based on a series of periodic cas"
      },
      {
        "name": "ODDFPRICE",
        "hint": "Returns the price per $100 face value of a security with an odd first period"
      },
      {
        "name": "ODDFYIELD",
        "hint": "Returns the yield of a security with an odd first period"
      },
      {
        "name": "ODDLPRICE",
        "hint": "Returns the price per $100 face value of a security with an odd last period"
      },
      {
        "name": "ODDLYIELD",
        "hint": "Returns the yield of a security with an odd last period"
      },
      {
        "name": "PDURATION",
        "hint": "Returns the number of periods required by an investment to reach a specified val"
      },
      {
        "name": "PMT",
        "hint": "Returns the periodic payment for an annuity"
      },
      {
        "name": "PPMT",
        "hint": "Returns the payment on the principal for an investment for a given period"
      },
      {
        "name": "PRICE",
        "hint": "Returns the price per $100 face value of a security that pays periodic interest"
      },
      {
        "name": "PRICEDISC",
        "hint": "Returns the price per $100 face value of a discounted security"
      },
      {
        "name": "PRICEMAT",
        "hint": "Returns the price per $100 face value of a security that pays interest at maturi"
      },
      {
        "name": "PV",
        "hint": "Returns the present value of an investment"
      },
      {
        "name": "RATE",
        "hint": "Returns the interest rate per period of an annuity"
      },
      {
        "name": "RECEIVED",
        "hint": "Returns the amount received at maturity for a fully invested security"
      },
      {
        "name": "RRI",
        "hint": "Returns an equivalent interest rate for the growth of an investment"
      },
      {
        "name": "SLN",
        "hint": "Returns the straight-line depreciation of an asset for one period"
      },
      {
        "name": "SYD",
        "hint": "Returns the sum-of-years' digits depreciation of an asset for a specified period"
      },
      {
        "name": "TBILLEQ",
        "hint": "Returns the bond-equivalent yield for a Treasury bill"
      },
      {
        "name": "TBILLPRICE",
        "hint": "Returns the price per $100 face value for a Treasury bill"
      },
      {
        "name": "TBILLYIELD",
        "hint": "Returns the yield for a Treasury bill"
      },
      {
        "name": "VDB",
        "hint": "Returns the depreciation of an asset for a specified or partial period by using "
      },
      {
        "name": "XIRR",
        "hint": "Returns the internal rate of return for a schedule of cash flows that is not nec"
      },
      {
        "name": "XNPV",
        "hint": "Returns the net present value for a schedule of cash flows that is not necessari"
      },
      {
        "name": "YIELD",
        "hint": "Returns the yield on a security that pays periodic interest"
      },
      {
        "name": "YIELDDISC",
        "hint": "Returns the annual yield for a discounted security; for example, a Treasury bill"
      },
      {
        "name": "YIELDMAT",
        "hint": "Returns the annual yield of a security that pays interest at maturity"
      }
    ]
  },
  {
    "category": "Logical",
    "fns": [
      {
        "name": "AND",
        "hint": "Returns TRUE if all of its arguments are TRUE"
      },
      {
        "name": "BYCOL",
        "hint": "Applies a LAMBDA to each column and returns an array of the results"
      },
      {
        "name": "BYROW",
        "hint": "Applies a LAMBDA to each row and returns an array of the results"
      },
      {
        "name": "FALSE",
        "hint": "Returns the logical value FALSE."
      },
      {
        "name": "IF",
        "hint": "Specifies a logical test to perform"
      },
      {
        "name": "IFERROR",
        "hint": "Returns a value you specify if a formula evaluates to an error; otherwise, retur"
      },
      {
        "name": "IFNA",
        "hint": "Returns the value you specify if the expression resolves to #N/A, otherwise retu"
      },
      {
        "name": "IFS",
        "hint": "Checks whether one or more conditions are met and returns a value that correspon"
      },
      {
        "name": "LAMBDA",
        "hint": "Create custom, reusable functions and call them by a friendly name"
      },
      {
        "name": "LET",
        "hint": "Assigns names to calculation results to allow storing intermediate calculations,"
      },
      {
        "name": "MAKEARRAY",
        "hint": "Returns a calculated array of a specified row and column size, by applying a LAM"
      },
      {
        "name": "MAP",
        "hint": "Returns an array formed by mapping each value in the array(s) to a new value by "
      },
      {
        "name": "NOT",
        "hint": "Reverses the logic of its argument."
      },
      {
        "name": "OR",
        "hint": "Returns TRUE if any argument is TRUE"
      },
      {
        "name": "REDUCE",
        "hint": "Reduces an array to an accumulated value by applying a LAMBDA to each value and "
      },
      {
        "name": "SCAN",
        "hint": "Scans an array by applying a LAMBDA to each value and returns an array that has "
      },
      {
        "name": "SWITCH",
        "hint": "Evaluates an expression against a list of values and returns the result correspo"
      },
      {
        "name": "TRUE",
        "hint": "Returns the logical value TRUE."
      },
      {
        "name": "XOR",
        "hint": "Returns TRUE if an odd number of arguments are TRUE"
      }
    ]
  },
  {
    "category": "Lookup",
    "fns": [
      {
        "name": "ADDRESS",
        "hint": "Returns a reference as text to a single cell in a worksheet"
      },
      {
        "name": "AREAS",
        "hint": "Returns the number of areas in a reference"
      },
      {
        "name": "CHOOSE",
        "hint": "Chooses a value from a list of values"
      },
      {
        "name": "CHOOSECOLS",
        "hint": "Returns the specified columns from an array"
      },
      {
        "name": "CHOOSEROWS",
        "hint": "Returns the specified rows from an array"
      },
      {
        "name": "COLUMN",
        "hint": "Returns the column number of a reference"
      },
      {
        "name": "COLUMNS",
        "hint": "Returns the number of columns in a reference"
      },
      {
        "name": "DROP",
        "hint": "Excludes a specified number of rows or columns from the start or end of an array"
      },
      {
        "name": "EXPAND",
        "hint": "Expands or pads an array to specified row and column dimensions"
      },
      {
        "name": "FILTER",
        "hint": "Filters a range of data based on criteria you define"
      },
      {
        "name": "FORMULATEXT",
        "hint": "Returns the formula at the given reference as text"
      },
      {
        "name": "GETPIVOTDATA",
        "hint": "Returns data stored in a PivotTable report"
      },
      {
        "name": "HLOOKUP",
        "hint": "Looks in the top row of an array and returns the value of the indicated cell"
      },
      {
        "name": "HSTACK",
        "hint": "Appends arrays horizontally and in sequence to return a larger array"
      },
      {
        "name": "HYPERLINK",
        "hint": "Creates a hyperlink inside a cell."
      },
      {
        "name": "IMAGE",
        "hint": "Returns an image from a given source"
      },
      {
        "name": "INDEX",
        "hint": "Uses an index to choose a value from a reference or array"
      },
      {
        "name": "INDIRECT",
        "hint": "Returns a reference indicated by a text value"
      },
      {
        "name": "LOOKUP",
        "hint": "Looks up values in a vector or array"
      },
      {
        "name": "MATCH",
        "hint": "Looks up values in a reference or array"
      },
      {
        "name": "OFFSET",
        "hint": "Returns a reference offset from a given reference"
      },
      {
        "name": "ROW",
        "hint": "Returns the row number of a reference"
      },
      {
        "name": "ROWS",
        "hint": "Returns the number of rows in a reference"
      },
      {
        "name": "RTD",
        "hint": "Retrieves real-time data from a program that supports COM automation"
      },
      {
        "name": "SORT",
        "hint": "Sorts the contents of a range or array"
      },
      {
        "name": "SORTBY",
        "hint": "Sorts the contents of a range or array based on the values in a corresponding ra"
      },
      {
        "name": "TAKE",
        "hint": "Returns a specified number of contiguous rows or columns from the start or end o"
      },
      {
        "name": "TOCOL",
        "hint": "Returns the array in a single column"
      },
      {
        "name": "TOROW",
        "hint": "Returns the array in a single row"
      },
      {
        "name": "TRANSPOSE",
        "hint": "Returns the transpose of an array"
      },
      {
        "name": "UNIQUE",
        "hint": "Returns a list of unique values in a list or range"
      },
      {
        "name": "VLOOKUP",
        "hint": "Looks in the first column of an array and moves across the row to return the val"
      },
      {
        "name": "VSTACK",
        "hint": "Appends arrays vertically and in sequence to return a larger array"
      },
      {
        "name": "WRAPCOLS",
        "hint": "Wraps the provided row or column of values by columns after a specified number o"
      },
      {
        "name": "WRAPROWS",
        "hint": "Wraps the provided row or column of values by rows after a specified number of e"
      },
      {
        "name": "XLOOKUP",
        "hint": "Searches a range or an array, and returns an item corresponding to the first mat"
      },
      {
        "name": "XMATCH",
        "hint": "Returns the relative position of an item in an array or range of cells."
      }
    ]
  },
  {
    "category": "Text",
    "fns": [
      {
        "name": "ASC",
        "hint": "Changes full-width (double-byte) English letters or katakana within a character "
      },
      {
        "name": "ARRAYTOTEXT",
        "hint": "Returns an array of text values from any specified range"
      },
      {
        "name": "BAHTTEXT",
        "hint": "Converts a number to text, using the ß (baht) currency format"
      },
      {
        "name": "CHAR",
        "hint": "Returns the character specified by the code number"
      },
      {
        "name": "CLEAN",
        "hint": "Removes all nonprintable characters from text"
      },
      {
        "name": "CODE",
        "hint": "Returns a numeric code for the first character in a text string"
      },
      {
        "name": "CONCAT",
        "hint": "Combines the text from multiple ranges and/or strings, but it doesn't provide th"
      },
      {
        "name": "CONCATENATE",
        "hint": "Joins several text items into one text item"
      },
      {
        "name": "DBCS",
        "hint": "Changes half-width (single-byte) English letters or katakana within a character "
      },
      {
        "name": "DOLLAR",
        "hint": "Converts a number to text using currency format"
      },
      {
        "name": "EXACT",
        "hint": "Checks to see if two text values are identical"
      },
      {
        "name": "FIND",
        "hint": "Finds one text value within another (case-sensitive)"
      },
      {
        "name": "FINDB",
        "hint": "Finds one text value within another (case-sensitive)"
      },
      {
        "name": "FIXED",
        "hint": "Formats a number as text with a fixed number of decimals"
      },
      {
        "name": "LEFT",
        "hint": "Returns the leftmost characters from a text value"
      },
      {
        "name": "LEFTB",
        "hint": "Returns the leftmost characters from a text value"
      },
      {
        "name": "LEN",
        "hint": "Returns the number of characters in a text string"
      },
      {
        "name": "LENB",
        "hint": "Returns the number of bytes used to represent the characters in a text string"
      },
      {
        "name": "LOWER",
        "hint": "Converts text to lowercase"
      },
      {
        "name": "MID",
        "hint": "Returns a specific number of characters from a text string starting at the posit"
      },
      {
        "name": "MIDB",
        "hint": "Returns a specific number of characters from a text string starting at the posit"
      },
      {
        "name": "NUMBERSTRING",
        "hint": "Convert numbers to Chinese strings"
      },
      {
        "name": "NUMBERVALUE",
        "hint": "Converts text to number in a locale-independent manner"
      },
      {
        "name": "PHONETIC",
        "hint": "Extracts the phonetic (furigana) characters from a text string"
      },
      {
        "name": "PROPER",
        "hint": "Capitalizes the first letter in each word of a text value"
      },
      {
        "name": "REGEXEXTRACT",
        "hint": "Extracts the first matching substrings according to a regular expression."
      },
      {
        "name": "REGEXMATCH",
        "hint": "Whether a piece of text matches a regular expression."
      },
      {
        "name": "REGEXREPLACE",
        "hint": "Replaces part of a text string with a different text string using regular expres"
      },
      {
        "name": "REPLACE",
        "hint": "Replaces characters within text"
      },
      {
        "name": "REPLACEB",
        "hint": "Replaces characters within text"
      },
      {
        "name": "REPT",
        "hint": "Repeats text a given number of times"
      },
      {
        "name": "RIGHT",
        "hint": "Returns the rightmost characters from a text value"
      },
      {
        "name": "RIGHTB",
        "hint": "Returns the rightmost characters from a text value"
      },
      {
        "name": "SEARCH",
        "hint": "Finds one text value within another (not case-sensitive)"
      },
      {
        "name": "SEARCHB",
        "hint": "Finds one text value within another (not case-sensitive)"
      },
      {
        "name": "SUBSTITUTE",
        "hint": "Substitutes new text for old text in a text string"
      },
      {
        "name": "T",
        "hint": "Converts its arguments to text"
      },
      {
        "name": "TEXT",
        "hint": "Formats a number and converts it to text"
      },
      {
        "name": "TEXTAFTER",
        "hint": "Returns text that occurs after given character or string"
      },
      {
        "name": "TEXTBEFORE",
        "hint": "Returns text that occurs before a given character or string"
      },
      {
        "name": "TEXTJOIN",
        "hint": "Text: Combines the text from multiple ranges and/or strings"
      },
      {
        "name": "TEXTSPLIT",
        "hint": "Splits text strings by using column and row delimiters"
      },
      {
        "name": "TRIM",
        "hint": "Removes spaces from text"
      },
      {
        "name": "UNICHAR",
        "hint": "Returns the Unicode character that is references by the given numeric value"
      },
      {
        "name": "UNICODE",
        "hint": "Returns the number (code point) that corresponds to the first character of the t"
      },
      {
        "name": "UPPER",
        "hint": "Converts text to uppercase"
      },
      {
        "name": "VALUE",
        "hint": "Converts a text argument to a number"
      },
      {
        "name": "VALUETOTEXT",
        "hint": "Returns text from any specified value"
      },
      {
        "name": "CALL",
        "hint": "Calls a procedure in a dynamic link library or code resource"
      },
      {
        "name": "EUROCONVERT",
        "hint": "Converts a number to euros, converts a number from euros to a euro member curren"
      },
      {
        "name": "REGISTER_ID",
        "hint": "Returns the register ID of the specified dynamic link library (DLL) or code reso"
      }
    ]
  },
  {
    "category": "Date",
    "fns": [
      {
        "name": "DATE",
        "hint": "Returns the serial number of a particular date"
      },
      {
        "name": "DATEDIF",
        "hint": "Calculates the number of days, months, or years between two dates. This function"
      },
      {
        "name": "DATEVALUE",
        "hint": "Converts a date in the form of text to a serial number"
      },
      {
        "name": "DAY",
        "hint": "Converts a serial number to a day of the month"
      },
      {
        "name": "DAYS",
        "hint": "Returns the number of days between two dates"
      },
      {
        "name": "DAYS360",
        "hint": "Calculates the number of days between two dates based on a 360-day year"
      },
      {
        "name": "EDATE",
        "hint": "Returns the serial number of the date that is the indicated number of months bef"
      },
      {
        "name": "EOMONTH",
        "hint": "Returns the serial number of the last day of the month before or after a specifi"
      },
      {
        "name": "EPOCHTODATE",
        "hint": "Converts a Unix epoch timestamp in seconds, milliseconds, or microseconds to a d"
      },
      {
        "name": "HOUR",
        "hint": "Converts a serial number to an hour"
      },
      {
        "name": "ISOWEEKNUM",
        "hint": "Returns the number of the ISO week number of the year for a given date"
      },
      {
        "name": "MINUTE",
        "hint": "Converts a serial number to a minute"
      },
      {
        "name": "MONTH",
        "hint": "Converts a serial number to a month"
      },
      {
        "name": "NETWORKDAYS",
        "hint": "Returns the number of whole workdays between two dates"
      },
      {
        "name": "NETWORKDAYS_INTL",
        "hint": "Returns the number of whole workdays between two dates using parameters to indic"
      },
      {
        "name": "NOW",
        "hint": "Returns the serial number of the current date and time"
      },
      {
        "name": "SECOND",
        "hint": "Converts a serial number to a second"
      },
      {
        "name": "TIME",
        "hint": "Returns the serial number of a particular time"
      },
      {
        "name": "TIMEVALUE",
        "hint": "Converts a time in the form of text to a serial number"
      },
      {
        "name": "TO_DATE",
        "hint": "Converts a provided number to a date."
      },
      {
        "name": "TODAY",
        "hint": "Returns the serial number of today's date"
      },
      {
        "name": "WEEKDAY",
        "hint": "Converts a serial number to a day of the week"
      },
      {
        "name": "WEEKNUM",
        "hint": "Converts a serial number to a number representing where the week falls numerical"
      },
      {
        "name": "WORKDAY",
        "hint": "Returns the serial number of the date before or after a specified number of work"
      },
      {
        "name": "WORKDAY_INTL",
        "hint": "Returns the serial number of the date before or after a specified number of work"
      },
      {
        "name": "YEAR",
        "hint": "Converts a serial number to a year"
      },
      {
        "name": "YEARFRAC",
        "hint": "Returns the year fraction representing the number of whole days between start_da"
      }
    ]
  },
  {
    "category": "Array",
    "fns": [
      {
        "name": "ARRAY_CONSTRAIN",
        "hint": "Constrains an array result to a specified size."
      },
      {
        "name": "FLATTEN",
        "hint": "Flattens all the values from one or more ranges into a single column."
      },
      {
        "name": "BETADIST",
        "hint": "Returns the beta cumulative distribution function"
      },
      {
        "name": "BETAINV",
        "hint": "Returns the inverse of the cumulative distribution function for a specified beta"
      },
      {
        "name": "BINOMDIST",
        "hint": "Returns the individual term binomial distribution probability"
      },
      {
        "name": "CHIDIST",
        "hint": "Returns the right-tailed probability of the chi-squared distribution."
      },
      {
        "name": "CHIINV",
        "hint": "Returns the inverse of the right-tailed probability of the chi-squared distribut"
      },
      {
        "name": "CHITEST",
        "hint": "Returns the test for independence"
      },
      {
        "name": "CONFIDENCE",
        "hint": "Returns the confidence interval for a population mean, using a normal distributi"
      },
      {
        "name": "COVAR",
        "hint": "Returns population covariance"
      },
      {
        "name": "CRITBINOM",
        "hint": "Returns the smallest value for which the cumulative binomial distribution is les"
      },
      {
        "name": "EXPONDIST",
        "hint": "Returns the exponential distribution"
      },
      {
        "name": "FDIST",
        "hint": "Returns the (right-tailed) F probability distribution"
      },
      {
        "name": "FINV",
        "hint": "Returns the inverse of the (right-tailed) F probability distribution"
      },
      {
        "name": "FTEST",
        "hint": "Returns the result of an F-test"
      },
      {
        "name": "GAMMADIST",
        "hint": "Returns the gamma distribution"
      },
      {
        "name": "GAMMAINV",
        "hint": "Returns the inverse of the gamma cumulative distribution"
      },
      {
        "name": "HYPGEOMDIST",
        "hint": "Returns the hypergeometric distribution"
      },
      {
        "name": "LOGINV",
        "hint": "Returns the inverse of the lognormal cumulative distribution function"
      },
      {
        "name": "LOGNORMDIST",
        "hint": "Returns the cumulative lognormal distribution"
      },
      {
        "name": "MODE",
        "hint": "Returns the most common value in a data set"
      },
      {
        "name": "NEGBINOMDIST",
        "hint": "Returns the negative binomial distribution"
      },
      {
        "name": "NORMDIST",
        "hint": "Returns the normal cumulative distribution"
      },
      {
        "name": "NORMINV",
        "hint": "Returns the inverse of the normal cumulative distribution"
      },
      {
        "name": "NORMSDIST",
        "hint": "Returns the standard normal cumulative distribution"
      },
      {
        "name": "NORMSINV",
        "hint": "Returns the inverse of the standard normal cumulative distribution"
      },
      {
        "name": "PERCENTILE",
        "hint": "Returns the k-th percentile of values in a data set (Includes 0 and 1)"
      },
      {
        "name": "PERCENTRANK",
        "hint": "Returns the percentage rank of a value in a data set (Includes 0 and 1)"
      },
      {
        "name": "POISSON",
        "hint": "Returns the Poisson distribution"
      },
      {
        "name": "QUARTILE",
        "hint": "Returns the quartile of a data set (Includes 0 and 1)"
      },
      {
        "name": "RANK",
        "hint": "Returns the rank of a number in a list of numbers"
      },
      {
        "name": "STDEV",
        "hint": "Estimates standard deviation based on a sample"
      },
      {
        "name": "STDEVP",
        "hint": "Calculates standard deviation based on the entire population"
      },
      {
        "name": "TDIST",
        "hint": "Returns the probability for the Student t-distribution"
      },
      {
        "name": "TINV",
        "hint": "Returns the inverse of the probability for the Student t-distribution (two-taile"
      },
      {
        "name": "TTEST",
        "hint": "Returns the probability associated with a Student's t-test"
      },
      {
        "name": "VAR",
        "hint": "Estimates variance based on a sample"
      },
      {
        "name": "VARP",
        "hint": "Calculates variance based on the entire population"
      },
      {
        "name": "WEIBULL",
        "hint": "Returns the Weibull distribution"
      },
      {
        "name": "ZTEST",
        "hint": "Returns the one-tailed probability-value of a z-test"
      }
    ]
  },
  {
    "category": "Engineering",
    "fns": [
      {
        "name": "BESSELI",
        "hint": "Returns the modified Bessel function In(x)"
      },
      {
        "name": "BESSELJ",
        "hint": "Returns the Bessel function Jn(x)"
      },
      {
        "name": "BESSELK",
        "hint": "Returns the modified Bessel function Kn(x)"
      },
      {
        "name": "BESSELY",
        "hint": "Returns the Bessel function Yn(x)"
      },
      {
        "name": "BIN2DEC",
        "hint": "Converts a binary number to decimal"
      },
      {
        "name": "BIN2HEX",
        "hint": "Converts a binary number to hexadecimal"
      },
      {
        "name": "BIN2OCT",
        "hint": "Converts a binary number to octal"
      },
      {
        "name": "BITAND",
        "hint": "Returns a 'Bitwise And' of two numbers"
      },
      {
        "name": "BITLSHIFT",
        "hint": "Returns a value number shifted left by shift_amount bits"
      },
      {
        "name": "BITOR",
        "hint": "Returns a bitwise OR of 2 numbers"
      },
      {
        "name": "BITRSHIFT",
        "hint": "Returns a value number shifted right by shift_amount bits"
      },
      {
        "name": "BITXOR",
        "hint": "Returns a bitwise 'Exclusive Or' of two numbers"
      },
      {
        "name": "COMPLEX",
        "hint": "Converts real and imaginary coefficients into a complex number"
      },
      {
        "name": "CONVERT",
        "hint": "Converts a number from one measurement system to another"
      },
      {
        "name": "DEC2BIN",
        "hint": "Converts a decimal number to binary"
      },
      {
        "name": "DEC2HEX",
        "hint": "Converts a decimal number to hexadecimal"
      },
      {
        "name": "DEC2OCT",
        "hint": "Converts a decimal number to octal"
      },
      {
        "name": "DELTA",
        "hint": "Tests whether two values are equal"
      },
      {
        "name": "ERF",
        "hint": "Returns the error function"
      },
      {
        "name": "ERF_PRECISE",
        "hint": "Returns the error function"
      },
      {
        "name": "ERFC",
        "hint": "Returns the complementary error function"
      },
      {
        "name": "ERFC_PRECISE",
        "hint": "Returns the complementary ERF function integrated between x and infinity"
      },
      {
        "name": "GESTEP",
        "hint": "Tests whether a number is greater than a threshold value"
      },
      {
        "name": "HEX2BIN",
        "hint": "Converts a hexadecimal number to binary"
      },
      {
        "name": "HEX2DEC",
        "hint": "Converts a hexadecimal number to decimal"
      },
      {
        "name": "HEX2OCT",
        "hint": "Converts a hexadecimal number to octal"
      },
      {
        "name": "IMABS",
        "hint": "Returns the absolute value (modulus) of a complex number"
      },
      {
        "name": "IMAGINARY",
        "hint": "Returns the imaginary coefficient of a complex number"
      },
      {
        "name": "IMARGUMENT",
        "hint": "Returns the argument theta, an angle expressed in radians"
      },
      {
        "name": "IMCONJUGATE",
        "hint": "Returns the complex conjugate of a complex number"
      },
      {
        "name": "IMCOS",
        "hint": "Returns the cosine of a complex number"
      },
      {
        "name": "IMCOSH",
        "hint": "Returns the hyperbolic cosine of a complex number"
      },
      {
        "name": "IMCOT",
        "hint": "Returns the cotangent of a complex number"
      },
      {
        "name": "IMCOTH",
        "hint": "Returns the hyperbolic cotangent of a complex number"
      },
      {
        "name": "IMCSC",
        "hint": "Returns the cosecant of a complex number"
      },
      {
        "name": "IMCSCH",
        "hint": "Returns the hyperbolic cosecant of a complex number"
      },
      {
        "name": "IMDIV",
        "hint": "Returns the quotient of two complex numbers"
      },
      {
        "name": "IMEXP",
        "hint": "Returns the exponential of a complex number"
      },
      {
        "name": "IMLN",
        "hint": "Returns the natural logarithm of a complex number"
      },
      {
        "name": "IMLOG",
        "hint": "Returns the logarithm of a complex number for a specified base"
      },
      {
        "name": "IMLOG10",
        "hint": "Returns the base-10 logarithm of a complex number"
      },
      {
        "name": "IMLOG2",
        "hint": "Returns the base-2 logarithm of a complex number"
      },
      {
        "name": "IMPOWER",
        "hint": "Returns a complex number raised to an integer power"
      },
      {
        "name": "IMPRODUCT",
        "hint": "Returns the product of from 1 to 255 complex numbers"
      },
      {
        "name": "IMREAL",
        "hint": "Returns the real coefficient of a complex number"
      },
      {
        "name": "IMSEC",
        "hint": "Returns the secant of a complex number"
      },
      {
        "name": "IMSECH",
        "hint": "Returns the hyperbolic secant of a complex number"
      },
      {
        "name": "IMSIN",
        "hint": "Returns the sine of a complex number"
      },
      {
        "name": "IMSINH",
        "hint": "Returns the hyperbolic sine of a complex number"
      },
      {
        "name": "IMSQRT",
        "hint": "Returns the square root of a complex number"
      },
      {
        "name": "IMSUB",
        "hint": "Returns the difference between two complex numbers"
      },
      {
        "name": "IMSUM",
        "hint": "Returns the sum of complex numbers"
      },
      {
        "name": "IMTAN",
        "hint": "Returns the tangent of a complex number"
      },
      {
        "name": "IMTANH",
        "hint": "Returns the hyperbolic tangent of a complex number"
      },
      {
        "name": "OCT2BIN",
        "hint": "Converts an octal number to binary"
      },
      {
        "name": "OCT2DEC",
        "hint": "Converts an octal number to decimal"
      },
      {
        "name": "OCT2HEX",
        "hint": "Converts an octal number to hexadecimal"
      }
    ]
  },
  {
    "category": "Database",
    "fns": [
      {
        "name": "DAVERAGE",
        "hint": "Returns the average of selected database entries"
      },
      {
        "name": "DCOUNT",
        "hint": "Counts the cells that contain numbers in a database"
      },
      {
        "name": "DCOUNTA",
        "hint": "Counts nonblank cells in a database"
      },
      {
        "name": "DGET",
        "hint": "Extracts from a database a single record that matches the specified criteria"
      },
      {
        "name": "DMAX",
        "hint": "Returns the maximum value from selected database entries"
      },
      {
        "name": "DMIN",
        "hint": "Returns the minimum value from selected database entries"
      },
      {
        "name": "DPRODUCT",
        "hint": "Multiplies the values in a particular field of records that match the criteria i"
      },
      {
        "name": "DSTDEV",
        "hint": "Estimates the standard deviation based on a sample of selected database entries"
      },
      {
        "name": "DSTDEVP",
        "hint": "Calculates the standard deviation based on the entire population of selected dat"
      },
      {
        "name": "DSUM",
        "hint": "Adds the numbers in the field column of records in the database that match the c"
      },
      {
        "name": "DVAR",
        "hint": "Estimates variance based on a sample from selected database entries"
      },
      {
        "name": "DVARP",
        "hint": "Calculates variance based on the entire population of selected database entries"
      }
    ]
  },
  {
    "category": "Info",
    "fns": [
      {
        "name": "CELL",
        "hint": "Returns information about the formatting, location, or contents of a cell"
      },
      {
        "name": "ERROR_TYPE",
        "hint": "Returns a number corresponding to an error type"
      },
      {
        "name": "INFO",
        "hint": "Returns information about the current operating environment"
      },
      {
        "name": "ISBETWEEN",
        "hint": "Checks whether a provided number is between two other numbers either inclusively"
      },
      {
        "name": "ISBLANK",
        "hint": "Returns TRUE if the value is blank"
      },
      {
        "name": "ISDATE",
        "hint": "Returns whether a value is a date."
      },
      {
        "name": "ISEMAIL",
        "hint": "Checks if a value is a valid email address"
      },
      {
        "name": "ISERR",
        "hint": "Returns TRUE if the value is any error value except #N/A"
      },
      {
        "name": "ISERROR",
        "hint": "Returns TRUE if the value is any error value"
      },
      {
        "name": "ISEVEN",
        "hint": "Returns TRUE if the number is even"
      },
      {
        "name": "ISFORMULA",
        "hint": "Returns TRUE if there is a reference to a cell that contains a formula"
      },
      {
        "name": "ISLOGICAL",
        "hint": "Returns TRUE if the value is a logical value"
      },
      {
        "name": "ISNA",
        "hint": "Returns TRUE if the value is the #N/A error value"
      },
      {
        "name": "ISNONTEXT",
        "hint": "Returns TRUE if the value is not text"
      },
      {
        "name": "ISNUMBER",
        "hint": "Returns TRUE if the value is a number"
      },
      {
        "name": "ISODD",
        "hint": "Returns TRUE if the number is odd"
      },
      {
        "name": "ISOMITTED",
        "hint": "Checks whether the value in a&nbsp;LAMBDA&nbsp;is missing and returns TRUE or FA"
      },
      {
        "name": "ISREF",
        "hint": "Returns TRUE if the value is a reference"
      },
      {
        "name": "ISTEXT",
        "hint": "Returns TRUE if the value is text"
      },
      {
        "name": "ISURL",
        "hint": "Checks whether a value is a valid URL."
      },
      {
        "name": "N",
        "hint": "Returns a value converted to a number"
      },
      {
        "name": "NA",
        "hint": "Returns the error value #N/A"
      },
      {
        "name": "SHEET",
        "hint": "Returns the sheet number of the referenced sheet"
      },
      {
        "name": "SHEETS",
        "hint": "Returns the number of sheets in a workbook"
      },
      {
        "name": "TYPE",
        "hint": "Returns a number indicating the data type of a value"
      }
    ]
  },
  {
    "category": "Cube",
    "fns": [
      {
        "name": "CUBEKPIMEMBER",
        "hint": "Returns a key performance indicator (KPI) property and displays the KPI name in "
      },
      {
        "name": "CUBEMEMBER",
        "hint": "Returns a member or tuple from the cube. Use to validate that the member or tupl"
      },
      {
        "name": "CUBEMEMBERPROPERTY",
        "hint": "Returns the value of a member property from the cube. Use to validate that a mem"
      },
      {
        "name": "CUBERANKEDMEMBER",
        "hint": "Returns the nth, or ranked, member in a set. Use to return one or more elements "
      },
      {
        "name": "CUBESET",
        "hint": "Defines a calculated set of members or tuples by sending a set expression to the"
      },
      {
        "name": "CUBESETCOUNT",
        "hint": "Returns the number of items in a set."
      },
      {
        "name": "CUBEVALUE",
        "hint": "Returns an aggregated value from the cube."
      }
    ]
  },
  {
    "category": "Univer",
    "fns": [
      {
        "name": "ENCODEURL",
        "hint": "Returns a URL-encoded string"
      },
      {
        "name": "FILTERXML",
        "hint": "Returns specific data from the XML content by using the specified XPath"
      },
      {
        "name": "WEBSERVICE",
        "hint": "Returns data from a web service"
      }
    ]
  }
];
