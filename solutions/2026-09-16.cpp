#include<bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;
const ll inf=1e18;
struct node{
    int x,y,z;
};
void solve(){
    int n,q;cin>>n>>q;
    vector<int>a(n+1);
    for(int i=1;i<=n;i++) cin>>a[i];
    auto b=a;
    vector<node>op(q+1);
    for(int i=1;i<=q;i++) cin>>op[i].x>>op[i].y>>op[i].z;
    reverse(op.begin()+1,op.end());
    for(int i=1;i<=q;i++){
        int x=op[i].x,y=op[i].y,z=op[i].z;
        int A=a[x],B=a[y],C=a[z];
        a[x]=max(A,C);
        a[y]=max(B,C);
        if(x!=z&&y!=z) a[z]=0;
    }
    reverse(op.begin()+1,op.end());
    auto c=a;
    for(int i=1;i<=q;i++){
        int x=op[i].x,y=op[i].y,z=op[i].z;
        c[z]=min(c[x],c[y]);
    }
    if(c!=b) {cout<<-1<<endl;return;}
    for(int i=1;i<=n;i++) cout<<a[i]<<" \n"[i==n];
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T=1;cin>>T;
    while(T--) solve();
    return 0;
}
